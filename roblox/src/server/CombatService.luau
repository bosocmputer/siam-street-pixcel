--!strict
-- Server-authoritative melee. The client only sends INTENT {seq, action, aim}; the server validates the request,
-- rate-limits it, picks the combo step and timing, resolves hits with spatial queries and applies damage.
-- Nothing here trusts a client-reported hit, damage, time or position.

local Workspace = game:GetService("Workspace")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared:WaitForChild("Config"))
local DamageMath = require(Shared:WaitForChild("DamageMath"))
local ComboLogic = require(Shared:WaitForChild("ComboLogic"))
local RateLimiter = require(Shared:WaitForChild("RateLimiter"))
local EnemyService = require(script.Parent:WaitForChild("EnemyService"))

type PlayerState = { seq: number, lastStart: number, step: number, busyUntil: number, swingToken: number }

local CombatService = {}
local limiter = RateLimiter.new(Config.combat.rateLimit.capacity, Config.combat.rateLimit.refillPerSecond)
local states: { [Player]: PlayerState } = {}
local actionResult: RemoteEvent
local stats = { dropped = 0, rejected = 0, accepted = 0 }

local function reject(player: Player, seq: number, reason: string)
	stats.rejected += 1
	actionResult:FireClient(player, { seq = seq, accepted = false, reason = reason })
end

local function isFiniteVector(v: Vector3): boolean
	return v.X == v.X and v.Y == v.Y and v.Z == v.Z and math.abs(v.X) < 1e4 and math.abs(v.Y) < 1e4 and math.abs(v.Z) < 1e4
end

-- Returns (ok, reasonCode). Anything malformed is refused before any real work happens.
local function validate(req: any): (boolean, string?)
	if type(req) ~= "table" then
		return false, "bad_request"
	end
	local seq, action, aim = req.seq, req.action, req.aim
	if type(seq) ~= "number" or seq ~= seq or seq % 1 ~= 0 or seq < 0 or seq > 2147483647 then
		return false, "bad_seq"
	end
	if action ~= "attack" then
		return false, "bad_action"
	end
	if typeof(aim) ~= "Vector3" or not isFiniteVector(aim) then
		return false, "bad_aim"
	end
	local m = aim.Magnitude
	if m < 0.5 or m > 2 then
		return false, "bad_aim"
	end
	return true, nil
end

local function aliveParts(player: Player): (Humanoid?, BasePart?)
	local char = player.Character
	local hum = char and char:FindFirstChildOfClass("Humanoid")
	local hrp = char and char:FindFirstChild("HumanoidRootPart")
	if hum and hum.Health > 0 and hrp and hrp:IsA("BasePart") then
		return hum, hrp
	end
	return nil, nil
end

-- Chooses the horizontal attack direction: the client's aim if it is within maxAimAngle of the character's facing
-- (this hides replication lag), otherwise the character's own facing.
local function attackDirection(hrp: BasePart, aim: Vector3): Vector3
	local look = Vector3.new(hrp.CFrame.LookVector.X, 0, hrp.CFrame.LookVector.Z)
	if look.Magnitude < 1e-3 then
		look = Vector3.new(0, 0, -1)
	end
	look = look.Unit
	local a = Vector3.new(aim.X, 0, aim.Z)
	if a.Magnitude < 1e-3 then
		return look
	end
	a = a.Unit
	local angle = math.deg(math.acos(math.clamp(look:Dot(a), -1, 1)))
	if angle <= Config.combat.maxAimAngleDeg then
		return a
	end
	return look
end

local function resolveHit(player: Player, character: Model, step: number, seq: number, aim: Vector3)
	-- The player may have died or respawned during the swing's hit delay.
	if player.Character ~= character then
		return
	end
	local hum, hrp = aliveParts(player)
	if not hum or not hrp then
		return
	end
	local def = Config.combat.steps[step]
	local dir = attackDirection(hrp, aim)
	local origin = hrp.Position
	local boxCf = CFrame.lookAt(origin, origin + dir) * CFrame.new(0, 0, -Config.combat.range / 2)
	local size = Vector3.new(Config.combat.width, Config.combat.height, Config.combat.range)

	local overlap = OverlapParams.new()
	overlap.FilterType = Enum.RaycastFilterType.Include
	overlap.FilterDescendantsInstances = { EnemyService.getFolder() }
	local parts = Workspace:GetPartBoundsInBox(boxCf, size, overlap)

	local seen: { [Model]: boolean } = {}
	local hits = {}
	local losParams = RaycastParams.new()
	local worlds = {}
	for _, name in Config.worldFolders do
		local w = Workspace:FindFirstChild(name)
		if w then
			table.insert(worlds, w)
		end
	end
	local world = #worlds > 0 and worlds or nil
	if world then
		losParams.FilterType = Enum.RaycastFilterType.Include
		losParams.FilterDescendantsInstances = worlds
	end
	for _, part in parts do
		local enemy = EnemyService.getEnemyFromPart(part)
		if enemy and not seen[enemy] then
			seen[enemy] = true -- one hit per target per swing
			local root = enemy.PrimaryPart
			if root then
				-- line of sight from chest height; walls block the swing
				local eye = origin + Vector3.new(0, 1.5, 0)
				local blocked = world ~= nil and Workspace:Raycast(eye, root.Position - eye, losParams) ~= nil
				if not blocked then
					local dmg = DamageMath.hit(def.damage, Config.player.attackRating, Config.enemies.slime.defense)
					local enemyId = EnemyService.getEnemyId(enemy) or 0 -- read before damage: a kill unregisters the enemy
					local died, hp = EnemyService.damage(enemy, dmg, player)
					table.insert(hits, { id = enemyId, damage = dmg, hp = hp, died = died, pos = root.Position })
				end
			end
		end
	end
	actionResult:FireClient(player, { seq = seq, accepted = true, step = step, hits = hits })
end

function CombatService.handle(player: Player, req: any)
	local now = os.clock()
	if not limiter:allow(player, now) then
		stats.dropped += 1 -- over the rate limit: drop silently (no reply spam either)
		return
	end
	local ok, why = validate(req)
	if not ok then
		reject(player, (type(req) == "table" and type(req.seq) == "number") and req.seq or -1, why or "bad_request")
		return
	end
	local st = states[player]
	if not st then
		st = { seq = -1, lastStart = -1e9, step = 0, busyUntil = 0, swingToken = 0 }
		states[player] = st
	end
	if req.seq <= st.seq then
		reject(player, req.seq, "stale_seq")
		return
	end
	st.seq = req.seq
	local hum, hrp = aliveParts(player)
	if not hum or not hrp then
		reject(player, req.seq, "not_alive")
		return
	end
	if now < st.busyUntil then
		reject(player, req.seq, "busy")
		return
	end
	local steps = Config.combat.steps
	local step = ComboLogic.nextStep(st.step, now - st.lastStart, Config.combat.sequenceWindow, #steps)
	local def = steps[step]
	st.step, st.lastStart, st.busyUntil = step, now, now + def.duration
	stats.accepted += 1
	local character = player.Character :: Model
	-- cosmetic swing trail on the sword (replicates to everyone); switched off when this swing's time is up
	local sword = character:FindFirstChild("TrainingSword")
	local trail = sword and sword:FindFirstChildWhichIsA("Trail", true)
	if trail then
		st.swingToken += 1
		local token = st.swingToken
		trail.Enabled = true
		task.delay(def.duration, function()
			local cur = states[player]
			if cur and cur.swingToken == token then
				trail.Enabled = false
			end
		end)
	end
	local aim = req.aim :: Vector3
	task.delay(def.hitDelay, function()
		resolveHit(player, character, step, req.seq, aim)
	end)
end

function CombatService.getStats()
	return { dropped = stats.dropped, rejected = stats.rejected, accepted = stats.accepted }
end

function CombatService.resetStats()
	stats.dropped, stats.rejected, stats.accepted = 0, 0, 0
end

function CombatService.start(request: RemoteEvent, result: RemoteEvent)
	actionResult = result
	request.OnServerEvent:Connect(function(player: Player, req: any)
		CombatService.handle(player, req)
	end)
	Players.PlayerRemoving:Connect(function(player: Player)
		states[player] = nil
		limiter:remove(player)
	end)
end

return CombatService

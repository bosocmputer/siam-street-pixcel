--!strict
-- Server-side slime enemies: kinematic movement (no client physics ownership), 15 Hz decision tick, state machine
-- Idle -> Chase -> Windup -> Dash -> Recover -> Chase/Return -> Dead. The server owns HP, targeting and damage.
-- Visual: ServerStorage.EchoAtlas.Prefabs.SlimeVisual (free jelly-slime asset, rig/scripts stripped, recoloured) when
-- present; otherwise a procedural glass ball with eyes. See roblox/assets/third-party-assets.md.
-- Squash & stretch is driven from the AI tick (breathing, crouch before the pounce, stretch while dashing).

local Workspace = game:GetService("Workspace")
local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local ServerStorage = game:GetService("ServerStorage")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared:WaitForChild("Config"))
local DamageMath = require(Shared:WaitForChild("DamageMath"))

local DEF = Config.enemies.slime
local STUD = 0.28
local TICK = 1 / 15
local RADIUS = DEF.bodyDiameter / 2

type State = "Idle" | "Chase" | "Windup" | "Dash" | "Recover" | "Return" | "Dead"
type VisualPart = { part: BasePart, rel: CFrame, baseSize: Vector3, baseColor: Color3, tintable: boolean }
type Enemy = {
	id: number,
	spawnIndex: number,
	model: Model,
	root: BasePart,
	body: BasePart,
	yOff: number, -- root height above the ground
	visuals: { VisualPart },
	home: Vector3,
	hp: number,
	state: State,
	stateStart: number,
	stateUntil: number,
	target: Player?,
	dashDir: Vector3,
	damagedThisDash: boolean,
	squashX: number,
	squashY: number,
	flashUntil: number,
}

local EnemyService = {}
local enemies: { [Model]: Enemy } = {}
local folder: Folder
local nextId = 1
local running = false

local function worldParams(): RaycastParams
	local p = RaycastParams.new()
	local worlds = {}
	for _, name in Config.worldFolders do
		local w = Workspace:FindFirstChild(name)
		if w then
			table.insert(worlds, w)
		end
	end
	if #worlds > 0 then
		p.FilterType = Enum.RaycastFilterType.Include
		p.FilterDescendantsInstances = worlds
	else
		p.FilterType = Enum.RaycastFilterType.Exclude
		p.FilterDescendantsInstances = { folder }
	end
	return p
end

local function groundY(x: number, z: number, fromY: number): number?
	local hit = Workspace:Raycast(Vector3.new(x, fromY + 6, z), Vector3.new(0, -30, 0), worldParams())
	return hit and hit.Position.Y or nil
end

local function makePart(name: string, size: Vector3, color: Color3, shape: Enum.PartType?): Part
	local p = Instance.new("Part")
	p.Name = name
	p.Anchored = true
	p.CanCollide = false
	p.CanTouch = false
	p.CanQuery = false
	p.Size = size
	p.Color = color
	p.Material = Enum.Material.SmoothPlastic
	if shape then
		p.Shape = shape
	end
	return p
end

local function getPrefab(): Model?
	local root = ServerStorage:FindFirstChild("EchoAtlas")
	local prefabs = root and root:FindFirstChild("Prefabs")
	local m = prefabs and prefabs:FindFirstChild("SlimeVisual")
	return m and m:IsA("Model") and m or nil
end

-- Procedural fallback body.
local function buildProcedural(pos: Vector3): (Model, BasePart, BasePart, { VisualPart })
	local model = Instance.new("Model")
	model.Name = "Slime"
	local d = DEF.bodyDiameter
	local root = makePart("Root", Vector3.new(1, 1, 1), Color3.new(1, 1, 1))
	root.Transparency = 1
	local body = makePart("Body", Vector3.new(d, d * 0.85, d), Color3.fromHex("79DDE8"), Enum.PartType.Ball)
	body.Transparency = 0.2
	body.Material = Enum.Material.Glass
	body.CanQuery = true
	local eyeL = makePart("EyeL", Vector3.new(0.45, 0.45, 0.45), Color3.fromHex("1B1F24"), Enum.PartType.Ball)
	local eyeR = makePart("EyeR", Vector3.new(0.45, 0.45, 0.45), Color3.fromHex("1B1F24"), Enum.PartType.Ball)
	for _, p in { root, body, eyeL, eyeR } do
		p.Parent = model
	end
	model.PrimaryPart = root
	local base = CFrame.new(pos)
	root.CFrame = base
	body.CFrame = base
	eyeL.CFrame = base * CFrame.new(-0.6, 0.25, -d * 0.38)
	eyeR.CFrame = base * CFrame.new(0.6, 0.25, -d * 0.38)
	local vis: { VisualPart } = {}
	for _, p in { body, eyeL, eyeR } do
		table.insert(vis, { part = p, rel = base:ToObjectSpace(p.CFrame), baseSize = p.Size, baseColor = p.Color, tintable = p == body })
	end
	return model, root, body, vis
end

local function build(pos: Vector3): (Model, BasePart, BasePart, { VisualPart }, number)
	local proto = getPrefab()
	if not proto then
		local m, r, b, v = buildProcedural(pos)
		return m, r, b, v, RADIUS * 0.85
	end
	local model = proto:Clone()
	model.Name = "Slime"
	model:ScaleTo(0.85)
	local root = model.PrimaryPart :: BasePart
	model:PivotTo(CFrame.new(pos))
	-- find how far the lowest point of the visual hangs below the root so it can rest exactly on the ground
	local cf, size = model:GetBoundingBox()
	local bottomBelowRoot = root.Position.Y - (cf.Position.Y - size.Y / 2)
	local vis: { VisualPart } = {}
	local body = model:FindFirstChild("Body") :: BasePart
	for _, p in model:GetChildren() do
		if p:IsA("BasePart") and p ~= root then
			table.insert(vis, {
				part = p,
				rel = root.CFrame:ToObjectSpace(p.CFrame),
				baseSize = p.Size,
				baseColor = p.Color,
				tintable = (p.Name == "Body" or p.Name == "Head" or p.Name == "BodySlime" or p.Name == "HeadSlime"),
			})
		end
	end
	-- small white highlights on the eyes make the face read as wet and alive
	for _, eyeName in { "LeftEye", "RightEye" } do
		local eye = model:FindFirstChild(eyeName) :: BasePart?
		if eye then
			local shine = makePart(eyeName .. "Shine", eye.Size * 0.32, Color3.new(1, 1, 1), Enum.PartType.Ball)
			shine.Material = Enum.Material.Neon
			shine.CFrame = eye.CFrame * CFrame.new(eye.Size.X * 0.2, eye.Size.Y * 0.22, -eye.Size.Z * 0.36)
			shine.Parent = model
			table.insert(vis, { part = shine, rel = root.CFrame:ToObjectSpace(shine.CFrame), baseSize = shine.Size, baseColor = shine.Color, tintable = false })
		end
	end
	return model, root, body, vis, bottomBelowRoot
end

local function spawnSlime(index: number)
	local sp = Config.slimeSpawnsMeters[index]
	local x, z = sp[1] / STUD, sp[2] / STUD
	local gy = groundY(x, z, 40) or 0
	local model, root, body, vis, yOff = build(Vector3.new(x, gy + RADIUS * 0.85, z))
	model:PivotTo(CFrame.new(x, gy + yOff, z))
	local id = nextId
	nextId += 1
	model:SetAttribute("IsEnemy", true)
	model:SetAttribute("EnemyId", id)
	model:SetAttribute("EnemyType", DEF.id)
	model:SetAttribute("Hp", DEF.maxHp)
	model:SetAttribute("MaxHp", DEF.maxHp)
	model.Parent = folder
	enemies[model] = {
		id = id,
		spawnIndex = index,
		model = model,
		root = root,
		body = body,
		yOff = yOff,
		visuals = vis,
		home = Vector3.new(x, gy + yOff, z),
		hp = DEF.maxHp,
		state = "Idle",
		stateStart = 0,
		stateUntil = 0,
		target = nil,
		dashDir = Vector3.zero,
		damagedThisDash = false,
		squashX = 1,
		squashY = 1,
		flashUntil = 0,
	}
end

local function aliveCharacter(player: Player): (Humanoid?, BasePart?)
	local char = player.Character
	local hum = char and char:FindFirstChildOfClass("Humanoid")
	local hrp = char and char:FindFirstChild("HumanoidRootPart")
	if hum and hrp and hum.Health > 0 and hrp:IsA("BasePart") then
		return hum, hrp
	end
	return nil, nil
end

local function flat(v: Vector3): Vector3
	return Vector3.new(v.X, 0, v.Z)
end

local function nearestPlayer(e: Enemy, maxDist: number): (Player?, number)
	local best: Player?, bestD = nil, maxDist
	for _, pl in Players:GetPlayers() do
		local _, hrp = aliveCharacter(pl)
		if hrp then
			local d = flat(hrp.Position - e.root.Position).Magnitude
			if d <= bestD then
				best, bestD = pl, d
			end
		end
	end
	return best, bestD
end

-- Squash and stretch about the root: sx scales width/depth, sy scales height. Parts stay glued together.
local function applySquash(e: Enemy, sx: number, sy: number)
	if math.abs(sx - e.squashX) < 0.005 and math.abs(sy - e.squashY) < 0.005 then
		return
	end
	e.squashX, e.squashY = sx, sy
	local rootCf = e.root.CFrame
	local sc = Vector3.new(sx, sy, sx)
	for _, v in e.visuals do
		local rel = v.rel
		v.part.Size = v.baseSize * sc
		v.part.CFrame = rootCf * CFrame.new(rel.Position * sc) * (rel - rel.Position)
	end
end

local function tint(e: Enemy, color: Color3?)
	for _, v in e.visuals do
		if v.tintable then
			v.part.Color = color or v.baseColor
		end
	end
end

-- Moves the slime on the ground; returns false when blocked by a wall/edge (it simply stays put).
local function stepToward(e: Enemy, dir: Vector3, speed: number, dt: number): boolean
	local f = flat(dir)
	if f.Magnitude < 1e-3 then
		return false
	end
	f = f.Unit
	local travel = speed * dt
	local pos = e.root.Position
	local params = worldParams()
	if Workspace:Raycast(pos, f * (travel + RADIUS), params) then
		return false
	end
	local nx, nz = pos.X + f.X * travel, pos.Z + f.Z * travel
	local gy = groundY(nx, nz, pos.Y)
	if not gy then
		return false
	end
	local newY = gy + e.yOff * e.squashY
	if newY - pos.Y > 2.5 then
		return false -- too steep a step
	end
	local newPos = Vector3.new(nx, newY, nz)
	e.model:PivotTo(CFrame.lookAt(newPos, newPos + f))
	return true
end

local function setState(e: Enemy, state: State, now: number, duration: number?)
	e.state = state
	e.stateStart = now
	e.stateUntil = now + (duration or 0)
	if state == "Windup" then
		tint(e, Color3.fromHex("F18D59")) -- warning colour from the art bible
	elseif state == "Recover" or state == "Chase" or state == "Idle" or state == "Return" then
		tint(e, nil)
	end
end

-- Per-tick body language (breathing, crouch, stretch). Cheap: one resize pass per enemy per tick, only when it changed.
local function animate(e: Enemy, now: number)
	local sx, sy = 1, 1
	if e.state == "Windup" then
		local t = math.clamp((now - e.stateStart) / DEF.windup, 0, 1)
		sy = 1 - 0.5 * t * t
		sx = 1 + 0.28 * t
	elseif e.state == "Dash" then
		sy, sx = 1.2, 0.88
	elseif e.state == "Recover" then
		local t = math.clamp((now - e.stateStart) / 0.35, 0, 1)
		sy = 0.78 + 0.22 * t
		sx = 1.12 - 0.12 * t
	else
		local b = math.sin(now * 3.2 + e.id * 1.7)
		sy, sx = 1 + 0.045 * b, 1 - 0.025 * b
	end
	applySquash(e, sx, sy)
	if e.flashUntil > 0 and now >= e.flashUntil then
		e.flashUntil = 0
		tint(e, e.state == "Windup" and Color3.fromHex("F18D59") or nil)
	end
end

local function damagePlayersNear(e: Enemy)
	for _, pl in Players:GetPlayers() do
		local hum, hrp = aliveCharacter(pl)
		if hum and hrp and (hrp.Position - e.root.Position).Magnitude <= DEF.hitRadius + 1.5 then
			hum:TakeDamage(DamageMath.hit(DEF.damage, Config.player.attackRating, Config.player.defense))
			e.damagedThisDash = true
		end
	end
end

local function tickEnemy(e: Enemy, now: number)
	if e.state == "Dead" then
		return
	end
	local tgt = e.target
	local hum, hrp
	if tgt then
		hum, hrp = aliveCharacter(tgt)
		if not hrp then
			e.target = nil
		end
	end
	local distHome = flat(e.root.Position - e.home).Magnitude

	if e.state == "Idle" then
		local p = nearestPlayer(e, DEF.noticeRange)
		if p then
			e.target = p
			setState(e, "Chase", now)
		end
	elseif e.state == "Chase" then
		if not e.target or not hrp or distHome > DEF.leash then
			e.target = nil
			setState(e, "Return", now)
		else
			local toT = flat(hrp.Position - e.root.Position)
			if toT.Magnitude <= DEF.attackTrigger then
				setState(e, "Windup", now, DEF.windup)
			else
				stepToward(e, toT, DEF.walkSpeed, TICK)
			end
		end
	elseif e.state == "Windup" then
		if hrp then
			local toT = flat(hrp.Position - e.root.Position)
			if toT.Magnitude > 0.1 then
				e.model:PivotTo(CFrame.lookAt(e.root.Position, e.root.Position + toT))
				e.dashDir = toT.Unit
			end
		end
		if now >= e.stateUntil then
			setState(e, "Dash", now, DEF.dashTime)
		end
	elseif e.state == "Dash" then
		stepToward(e, e.dashDir, DEF.dashSpeed, TICK)
		if not e.damagedThisDash then
			damagePlayersNear(e)
		end
		if now >= e.stateUntil then
			setState(e, "Recover", now, DEF.recover)
		end
	elseif e.state == "Recover" then
		if now >= e.stateUntil then
			setState(e, e.target and "Chase" or "Return", now)
		end
	elseif e.state == "Return" then
		if distHome < 2 then
			e.hp = DEF.maxHp
			e.model:SetAttribute("Hp", e.hp)
			setState(e, "Idle", now)
		else
			stepToward(e, e.home - e.root.Position, DEF.walkSpeed * 1.4, TICK)
			local p = nearestPlayer(e, DEF.noticeRange * 0.6)
			if p and distHome < DEF.leash * 0.6 then
				e.target = p
				setState(e, "Chase", now)
			end
		end
	end
	animate(e, now)
end

-- Droplet burst when a slime pops (engine ParticleEmitter, no external asset).
local function burst(e: Enemy)
	local emitterHost = e.body
	local pe = Instance.new("ParticleEmitter")
	pe.Rate = 0
	pe.Lifetime = NumberRange.new(0.5, 0.9)
	pe.Speed = NumberRange.new(10, 22)
	pe.SpreadAngle = Vector2.new(180, 180)
	pe.Acceleration = Vector3.new(0, -45, 0)
	pe.Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.55), NumberSequenceKeypoint.new(1, 0.1) })
	pe.Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.1), NumberSequenceKeypoint.new(1, 1) })
	pe.Color = ColorSequence.new(Color3.fromHex("79DDE8"), Color3.fromHex("2B86A8"))
	pe.LightEmission = 0.3
	pe.Parent = emitterHost
	pe:Emit(26)
end

local function kill(e: Enemy)
	e.state = "Dead"
	e.model:SetAttribute("Dead", true)
	burst(e)
	local info = TweenInfo.new(0.35)
	for _, v in e.visuals do
		TweenService:Create(v.part, info, { Transparency = 1 }):Play()
	end
	applySquash(e, 1.25, 0.3)
	enemies[e.model] = nil
	local model, index = e.model, e.spawnIndex
	task.delay(1.0, function()
		model:Destroy()
	end)
	task.delay(DEF.respawn, function()
		if running then
			spawnSlime(index)
		end
	end)
end

-- Returns (died, remainingHp). Called only by server code (CombatService).
function EnemyService.damage(model: Model, amount: number, attacker: Player?): (boolean, number)
	local e = enemies[model]
	if not e or e.state == "Dead" or amount <= 0 then
		return false, e and e.hp or 0
	end
	e.hp = math.max(0, e.hp - amount)
	model:SetAttribute("Hp", e.hp)
	if attacker and aliveCharacter(attacker) then
		e.target = attacker
		if e.state == "Idle" or e.state == "Return" then
			setState(e, "Chase", os.clock())
		end
	end
	if e.hp <= 0 then
		kill(e)
		return true, 0
	end
	-- brief white hit flash
	tint(e, Color3.new(1, 1, 1))
	e.flashUntil = os.clock() + 0.09
	return false, e.hp
end

function EnemyService.getEnemyFromPart(part: Instance): Model?
	local m = part:FindFirstAncestorOfClass("Model")
	if m and enemies[m] then
		return m
	end
	return nil
end

function EnemyService.getEnemyId(model: Model): number?
	local e = enemies[model]
	return e and e.id or nil
end

function EnemyService.getFolder(): Folder
	return folder
end

function EnemyService.getInfo(model: Model): { hp: number, state: string }?
	local e = enemies[model]
	return e and { hp = e.hp, state = e.state } or nil
end

function EnemyService.start()
	if running then
		return
	end
	running = true
	folder = Workspace:FindFirstChild("Enemies") :: Folder
	if not folder then
		folder = Instance.new("Folder")
		folder.Name = "Enemies"
		folder.Parent = Workspace
	end
	for i = 1, #Config.slimeSpawnsMeters do
		spawnSlime(i)
	end
	task.spawn(function()
		while running do
			task.wait(TICK)
			local now = os.clock()
			for _, e in enemies do
				tickEnemy(e, now)
			end
		end
	end)
end

function EnemyService.stop()
	running = false
	for model, _ in enemies do
		model:Destroy()
	end
	table.clear(enemies)
end

return EnemyService

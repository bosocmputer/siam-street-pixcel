--!strict
-- LocalScript (StarterPlayerScripts). INPUT and COSMETICS only: it sends attack intent, plays a local swing effect and
-- shows enemy health bars / damage numbers from server data. It never decides hits, damage or cooldowns.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ContextActionService = game:GetService("ContextActionService")
local Workspace = game:GetService("Workspace")
local TweenService = game:GetService("TweenService")
local SoundService = game:GetService("SoundService")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared:WaitForChild("Config"))
if not Config.features.combat then
	return -- combat is switched off (Config.features.combat): no attack input, no button, no effects
end
local Remotes = ReplicatedStorage:WaitForChild("Remotes", 30)
if not Remotes then
	warn("[EchoAtlas] Remotes not found; combat client disabled")
	return
end
local ActionRequest = Remotes:WaitForChild("ActionRequest") :: RemoteEvent
local ActionResult = Remotes:WaitForChild("ActionResult") :: RemoteEvent

local player = Players.LocalPlayer
local camera = Workspace.CurrentCamera
local seq = 0
local lastSent = 0
local MIN_SEND_INTERVAL = 0.12 -- local politeness only; the server enforces the real rules

-- ---------------------------------------------------------------- sounds (ids from Config; verified to load)
local function makeSound(id: string, volume: number): Sound
	local s = Instance.new("Sound")
	s.SoundId = id
	s.Volume = volume
	s.RollOffMaxDistance = 80
	s.Parent = SoundService
	return s
end
local swingSound = makeSound(Config.audio.swing, 0.5)
local hitSound = makeSound(Config.audio.hit, 0.6)

-- ---------------------------------------------------------------- slash effect (free crescent decal, small pool)
local slashPool: { Part } = {}
local function newSlash(): Part
	local p = Instance.new("Part")
	p.Name = "SlashFx"
	p.Anchored = true
	p.CanCollide = false
	p.CanQuery = false
	p.CanTouch = false
	p.CastShadow = false
	p.Transparency = 1
	p.Size = Vector3.new(7.5, 0.05, 7.5)
	local d = Instance.new("Decal")
	d.Name = "Arc"
	d.Face = Enum.NormalId.Top
	d.Texture = Config.fx.slash
	d.Color3 = Color3.fromHex("A8F3FA")
	d.Transparency = 1
	d.Parent = p
	p.Parent = Workspace
	return p
end

local function getSlash(): Part
	for _, p in slashPool do
		local d = p:FindFirstChild("Arc") :: Decal
		if d.Transparency >= 1 then
			return p
		end
	end
	if #slashPool >= 4 then
		return slashPool[1]
	end
	local p = newSlash()
	table.insert(slashPool, p)
	return p
end

local SWEEP_ANGLES = { -25, 200, 80 } -- each combo step sweeps from a different side

local function playSlash(step: number)
	local char = player.Character
	local hrp = char and char:FindFirstChild("HumanoidRootPart") :: BasePart?
	if not hrp then
		return
	end
	local p = getSlash()
	local d = p:FindFirstChild("Arc") :: Decal
	local rot = SWEEP_ANGLES[((step - 1) % #SWEEP_ANGLES) + 1]
	p.Size = Vector3.new(6, 0.05, 6)
	p.CFrame = hrp.CFrame * CFrame.new(0, 0.5, -3.4) * CFrame.Angles(0, math.rad(rot), 0)
	d.Transparency = 0.05
	TweenService:Create(d, TweenInfo.new(0.22, Enum.EasingStyle.Quad, Enum.EasingDirection.In), { Transparency = 1 }):Play()
	TweenService:Create(p, TweenInfo.new(0.22, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { Size = Vector3.new(8.4, 0.05, 8.4) }):Play()
	swingSound.TimePosition = 0
	swingSound:Play()
end

-- hit flash (free starburst image) + a few sparks, at the enemy position reported by the server
local function spawnImpact(pos: Vector3)
	local anchor = Instance.new("Part")
	anchor.Name = "ImpactFx"
	anchor.Anchored = true
	anchor.CanCollide = false
	anchor.CanQuery = false
	anchor.CanTouch = false
	anchor.Transparency = 1
	anchor.Size = Vector3.one * 0.2
	anchor.Position = pos + Vector3.new(0, 1.2, 0)
	local gui = Instance.new("BillboardGui")
	gui.Size = UDim2.fromOffset(50, 50)
	gui.AlwaysOnTop = true
	gui.LightInfluence = 0
	gui.Adornee = anchor
	local img = Instance.new("ImageLabel")
	img.Size = UDim2.fromScale(1, 1)
	img.AnchorPoint = Vector2.new(0.5, 0.5)
	img.Position = UDim2.fromScale(0.5, 0.5)
	img.BackgroundTransparency = 1
	img.Image = Config.fx.impact
	img.ImageColor3 = Color3.fromHex("C8F6FF")
	img.Parent = gui
	gui.Parent = anchor
	local sparks = Instance.new("ParticleEmitter")
	sparks.Rate = 0
	sparks.Lifetime = NumberRange.new(0.18, 0.32)
	sparks.Speed = NumberRange.new(12, 22)
	sparks.SpreadAngle = Vector2.new(180, 180)
	sparks.Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.3), NumberSequenceKeypoint.new(1, 0) })
	sparks.Color = ColorSequence.new(Color3.fromHex("FFFFFF"), Color3.fromHex("79DDE8"))
	sparks.LightEmission = 0.8
	sparks.Parent = anchor
	anchor.Parent = Workspace
	sparks:Emit(10)
	TweenService:Create(img, TweenInfo.new(0.18, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { Size = UDim2.fromScale(2.6, 2.6), ImageTransparency = 1 }):Play()
	task.delay(0.6, function()
		anchor:Destroy()
	end)
end

-- ---------------------------------------------------------------- input -> intent
local function faceCamera(hrp: BasePart)
	local look = camera.CFrame.LookVector
	local flat = Vector3.new(look.X, 0, look.Z)
	if flat.Magnitude > 0.01 then
		hrp.CFrame = CFrame.lookAt(hrp.Position, hrp.Position + flat)
	end
end

local function onAttack(_name: string, state: Enum.UserInputState, _obj: InputObject)
	if state ~= Enum.UserInputState.Begin then
		return Enum.ContextActionResult.Pass
	end
	local now = os.clock()
	if now - lastSent < MIN_SEND_INTERVAL then
		return Enum.ContextActionResult.Sink
	end
	local char = player.Character
	local hum = char and char:FindFirstChildOfClass("Humanoid")
	local hrp = char and char:FindFirstChild("HumanoidRootPart") :: BasePart?
	if not hum or hum.Health <= 0 or not hrp then
		return Enum.ContextActionResult.Sink
	end
	lastSent = now
	faceCamera(hrp)
	seq += 1
	local look = camera.CFrame.LookVector
	ActionRequest:FireServer({ seq = seq, action = "attack", aim = Vector3.new(look.X, 0, look.Z).Unit })
	return Enum.ContextActionResult.Sink
end

ContextActionService:BindAction("EchoAttack", onAttack, true, Enum.UserInputType.MouseButton1, Enum.KeyCode.ButtonR2, Enum.KeyCode.F)
ContextActionService:SetTitle("EchoAttack", "ฟัน")
ContextActionService:SetPosition("EchoAttack", UDim2.new(1, -130, 1, -190))

-- ---------------------------------------------------------------- server results -> cosmetics
local function spawnDamageNumber(pos: Vector3, amount: number)
	local anchor = Instance.new("Part")
	anchor.Anchored = true
	anchor.CanCollide = false
	anchor.CanQuery = false
	anchor.CanTouch = false
	anchor.Transparency = 1
	anchor.Size = Vector3.one * 0.1
	anchor.Position = pos + Vector3.new(0, 3, 0)
	local gui = Instance.new("BillboardGui")
	gui.Size = UDim2.fromOffset(80, 30)
	gui.AlwaysOnTop = true
	gui.Adornee = anchor
	local lbl = Instance.new("TextLabel")
	lbl.Size = UDim2.fromScale(1, 1)
	lbl.BackgroundTransparency = 1
	lbl.Text = tostring(amount)
	lbl.TextColor3 = Color3.fromHex("FFE9A8")
	lbl.TextStrokeTransparency = 0.4
	lbl.Font = Enum.Font.BuilderSansBold
	lbl.TextScaled = true
	lbl.Parent = gui
	gui.Parent = anchor
	anchor.Parent = Workspace
	TweenService:Create(anchor, TweenInfo.new(0.7, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { Position = anchor.Position + Vector3.new(0, 3, 0) }):Play()
	TweenService:Create(lbl, TweenInfo.new(0.7), { TextTransparency = 1, TextStrokeTransparency = 1 }):Play()
	task.delay(0.8, function()
		anchor:Destroy()
	end)
end

ActionResult.OnClientEvent:Connect(function(res: any)
	if type(res) ~= "table" then
		return
	end
	if res.accepted and type(res.step) == "number" and res.hits == nil then
		return
	end
	if res.accepted and type(res.hits) == "table" then
		playSlash(res.step or 1)
		local any = false
		for _, h in res.hits do
			if typeof(h.pos) == "Vector3" and type(h.damage) == "number" then
				spawnDamageNumber(h.pos, h.damage)
				spawnImpact(h.pos)
				any = true
			end
		end
		if any then
			hitSound.TimePosition = 0
			hitSound:Play()
		end
	end
end)

-- ---------------------------------------------------------------- enemy health bars (from server attributes)
-- Streaming-safe: the model can arrive before its parts, so wait (with a timeout) instead of assuming.
local function attachHealthBar(model: Model)
	local body = model:WaitForChild("Body", 10) :: BasePart?
	if not body or body:FindFirstChild("HpBar") then
		return
	end
	local gui = Instance.new("BillboardGui")
	gui.Name = "HpBar"
	gui.Size = UDim2.fromOffset(70, 8)
	gui.StudsOffset = Vector3.new(0, 3.2, 0)
	gui.AlwaysOnTop = false
	gui.MaxDistance = 90
	gui.Adornee = body
	local back = Instance.new("Frame")
	back.Size = UDim2.fromScale(1, 1)
	back.BackgroundColor3 = Color3.fromHex("1B1F24")
	back.BorderSizePixel = 0
	back.Parent = gui
	local fill = Instance.new("Frame")
	fill.Size = UDim2.fromScale(1, 1)
	fill.BackgroundColor3 = Color3.fromHex("5BD17A")
	fill.BorderSizePixel = 0
	fill.Parent = back
	gui.Parent = body
	local function update()
		local hp, maxHp = model:GetAttribute("Hp"), model:GetAttribute("MaxHp")
		if type(hp) == "number" and type(maxHp) == "number" and maxHp > 0 then
			fill.Size = UDim2.fromScale(math.clamp(hp / maxHp, 0, 1), 1)
		end
	end
	model:GetAttributeChangedSignal("Hp"):Connect(update)
	update()
end

local enemies = Workspace:WaitForChild("Enemies")
for _, m in enemies:GetChildren() do
	if m:IsA("Model") then
		task.spawn(attachHealthBar, m)
	end
end
enemies.ChildAdded:Connect(function(m)
	if m:IsA("Model") then
		task.spawn(attachHealthBar, m)
	end
end)

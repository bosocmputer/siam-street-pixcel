--!strict
-- LocalScript (StarterPlayerScripts). Minimal HUD: player health bar and a one-line control hint. Display only.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Config"))
if not Config.features.combat then
	return -- this HUD is only the combat health bar and attack hint; hidden while combat is off
end

local player = Players.LocalPlayer
local gui = Instance.new("ScreenGui")
gui.Name = "EchoHud"
gui.ResetOnSpawn = false
gui.IgnoreGuiInset = false
gui.Parent = player:WaitForChild("PlayerGui")

local bar = Instance.new("Frame")
bar.Name = "HpBack"
bar.AnchorPoint = Vector2.new(0, 1)
bar.Position = UDim2.new(0, 16, 1, -16)
bar.Size = UDim2.fromOffset(240, 18)
bar.BackgroundColor3 = Color3.fromHex("1B1F24")
bar.BorderSizePixel = 0
bar.Parent = gui

local fill = Instance.new("Frame")
fill.Name = "HpFill"
fill.Size = UDim2.fromScale(1, 1)
fill.BackgroundColor3 = Color3.fromHex("5BD17A")
fill.BorderSizePixel = 0
fill.Parent = bar

local label = Instance.new("TextLabel")
label.Size = UDim2.fromScale(1, 1)
label.BackgroundTransparency = 1
label.TextColor3 = Color3.new(1, 1, 1)
label.TextStrokeTransparency = 0.5
label.Font = Enum.Font.BuilderSansBold
label.TextSize = 14
label.Parent = bar

local hint = Instance.new("TextLabel")
hint.Name = "Hint"
hint.AnchorPoint = Vector2.new(0, 1)
hint.Position = UDim2.new(0, 16, 1, -42)
hint.Size = UDim2.fromOffset(300, 20)
hint.BackgroundTransparency = 1
hint.TextXAlignment = Enum.TextXAlignment.Left
hint.TextColor3 = Color3.fromHex("FFE9A8")
hint.TextStrokeTransparency = 0.5
hint.Font = Enum.Font.BuilderSans
hint.TextSize = 16
hint.Text = "คลิกซ้าย / ปุ่ม ฟัน = โจมตี"
hint.Parent = gui

local function bind(character: Model)
	local hum = character:WaitForChild("Humanoid") :: Humanoid
	local function update()
		local maxHp = math.max(hum.MaxHealth, 1)
		fill.Size = UDim2.fromScale(math.clamp(hum.Health / maxHp, 0, 1), 1)
		label.Text = string.format("%d / %d", math.ceil(hum.Health), math.ceil(hum.MaxHealth))
	end
	hum.HealthChanged:Connect(update)
	hum:GetPropertyChangedSignal("MaxHealth"):Connect(update)
	update()
end

player.CharacterAdded:Connect(bind)
if player.Character then
	bind(player.Character)
end

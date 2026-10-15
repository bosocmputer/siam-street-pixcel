--!strict
-- Applies player stats on spawn and attaches a purely cosmetic training sword (the server still decides every hit).

local Players = game:GetService("Players")
local ServerStorage = game:GetService("ServerStorage")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Config"))

local PlayerService = {}

local function swordPrefab(): Model?
	local r = ServerStorage:FindFirstChild("EchoAtlas")
	local p = r and r:FindFirstChild("Prefabs")
	local m = p and p:FindFirstChild("TrainingSword")
	return m and m:IsA("Model") and m or nil
end

local function attachSword(character: Model)
	local hand = character:FindFirstChild("RightHand") or character:FindFirstChild("Right Arm")
	if not hand or not hand:IsA("BasePart") then
		return
	end
	if character:FindFirstChild("TrainingSword") then
		return
	end
	local proto = swordPrefab()
	if proto then
		-- free wooden sword mesh: hilt in the hand, point forward (the mesh runs along its local Y, hilt at -Y)
		local sword = proto:Clone()
		sword.Name = "TrainingSword"
		local blade = sword.PrimaryPart :: BasePart
		local gripCf = hand.CFrame * CFrame.new(0, -0.3, -0.2) * CFrame.Angles(math.rad(-72), 0, 0) -- ready stance: point slightly raised
		blade.CFrame = gripCf * CFrame.new(0, blade.Size.Y / 2 - 0.35, 0)
		local weld = Instance.new("WeldConstraint")
		weld.Part0, weld.Part1 = hand, blade
		weld.Parent = blade
		sword.Parent = character
		return
	end
	local sword = Instance.new("Model")
	sword.Name = "TrainingSword"
	local grip = Instance.new("Part")
	grip.Name = "Grip"
	grip.Size = Vector3.new(0.3, 0.9, 0.3)
	grip.Color = Color3.fromHex("6A4A33")
	grip.Material = Enum.Material.Wood
	grip.CanCollide = false
	grip.CanQuery = false
	grip.CanTouch = false
	grip.Massless = true
	local blade = Instance.new("Part")
	blade.Name = "Blade"
	blade.Size = Vector3.new(0.22, 3.6, 0.07)
	blade.Color = Color3.fromHex("C9D3DB")
	blade.Material = Enum.Material.Metal
	blade.CanCollide = false
	blade.CanQuery = false
	blade.CanTouch = false
	blade.Massless = true
	grip.Parent = sword
	blade.Parent = sword
	sword.PrimaryPart = grip
	-- the blade extends forward (-Z of the hand) from the grip
	local gripCf = hand.CFrame * CFrame.new(0, -0.3, -0.2) * CFrame.Angles(math.rad(-90), 0, 0)
	grip.CFrame = gripCf
	blade.CFrame = gripCf * CFrame.new(0, 2.25, 0)
	local w1 = Instance.new("WeldConstraint")
	w1.Part0, w1.Part1 = hand, grip
	w1.Parent = grip
	local w2 = Instance.new("WeldConstraint")
	w2.Part0, w2.Part1 = grip, blade
	w2.Parent = blade
	sword.Parent = character
end

local function onCharacter(character: Model)
	local hum = character:WaitForChild("Humanoid", 10) :: Humanoid?
	if not hum then
		return
	end
	hum.MaxHealth = Config.player.maxHp
	hum.Health = Config.player.maxHp
	task.defer(attachSword, character)
end

function PlayerService.start()
	local function onPlayer(player: Player)
		player.CharacterAdded:Connect(onCharacter)
		if player.Character then
			onCharacter(player.Character)
		end
	end
	Players.PlayerAdded:Connect(onPlayer)
	for _, p in Players:GetPlayers() do
		onPlayer(p)
	end
end

return PlayerService

--!strict
-- Opens and closes the Tha Phae wooden double gates (Workspace.ThapaeWorld.Walls.GateDoors) when a player presses E
-- (a ProximityPrompt built by world/ThapaeBuilder.luau). The SERVER owns the gate state: clients only press the prompt;
-- distance, cooldown and state are validated here. Default state = whatever the build left (open).
-- The build gives each leaf a hidden Hinge part (PrimaryPart) and CFrame attributes ClosedCFrame / OpenCFrame. At start
-- every leaf part is welded to its hinge, so tweening the hinge swings the whole leaf.

local Workspace = game:GetService("Workspace")
local TweenService = game:GetService("TweenService")

local GateService = {}

local TWEEN = TweenInfo.new(0.9, Enum.EasingStyle.Quad, Enum.EasingDirection.InOut)
local COOLDOWN = 1.2 -- seconds between toggles of the gate
local MAX_DISTANCE = 30 -- studs from the prompt anchor; the prompt itself activates at 14, this guards against spoofed triggers

type Leaf = { hinge: BasePart, openCF: CFrame, closedCF: CFrame }

local leaves: { Leaf } = {}
local doors: Instance? = nil
local prompt: ProximityPrompt? = nil
local anchor: BasePart? = nil
local isOpen = true
local lastToggle = -math.huge

local function setPrompt()
	if prompt then
		prompt.ActionText = if isOpen then "ปิดประตู" else "เปิดประตู"
	end
end

local function pose(open: boolean, animate: boolean)
	for _, leaf in leaves do
		local target = if open then leaf.openCF else leaf.closedCF
		if animate then
			TweenService:Create(leaf.hinge, TWEEN, { CFrame = target }):Play()
		else
			leaf.hinge.CFrame = target
		end
	end
end

-- Toggle the gate. `player` is nil only for server-side tests. Returns the new state (true = open) or nil if refused.
function GateService.toggle(player: Player?): boolean?
	if #leaves == 0 then
		return nil
	end
	local now = os.clock()
	if now - lastToggle < COOLDOWN then
		return nil
	end
	if player then
		local char = player.Character
		local hrp = char and char:FindFirstChild("HumanoidRootPart")
		if not hrp or not hrp:IsA("BasePart") or not anchor or (hrp.Position - anchor.Position).Magnitude > MAX_DISTANCE then
			return nil
		end
	end
	lastToggle = now
	isOpen = not isOpen
	pose(isOpen, true)
	if doors then
		doors:SetAttribute("Open", isOpen)
	end
	setPrompt()
	return isOpen
end

function GateService.isOpen(): boolean
	return isOpen
end

function GateService.start()
	task.spawn(function()
		local world = Workspace:WaitForChild("ThapaeWorld", 30)
		local walls = world and world:WaitForChild("Walls", 30)
		doors = walls and walls:WaitForChild("GateDoors", 30)
		if not doors then
			warn("[EchoAtlas] GateDoors not found; gate service disabled")
			return
		end
		for _, leaf in doors:GetChildren() do
			local hinge = if leaf:IsA("Model") then leaf.PrimaryPart else nil
			local openCF, closedCF = leaf:GetAttribute("OpenCFrame"), leaf:GetAttribute("ClosedCFrame")
			if hinge and typeof(openCF) == "CFrame" and typeof(closedCF) == "CFrame" then
				-- weld first, then unanchor, so no part is ever free to fall
				for _, p in leaf:GetDescendants() do
					if p:IsA("BasePart") and p ~= hinge then
						local weld = Instance.new("WeldConstraint")
						weld.Part0 = hinge
						weld.Part1 = p
						weld.Parent = p
						p.Anchored = false
						p.Massless = true
					end
				end
				hinge.Anchored = true
				table.insert(leaves, { hinge = hinge, openCF = openCF, closedCF = closedCF })
			end
		end
		local a = doors:FindFirstChild("PromptAnchor")
		anchor = if a and a:IsA("BasePart") then a else nil
		local pr = anchor and anchor:FindFirstChildOfClass("ProximityPrompt")
		prompt = pr
		isOpen = doors:GetAttribute("Open") ~= false
		pose(isOpen, false)
		setPrompt()
		if pr then
			pr.Triggered:Connect(function(player: Player)
				GateService.toggle(player)
			end)
		else
			warn("[EchoAtlas] GatePrompt not found; the gate cannot be toggled by players")
		end
	end)
end

return GateService

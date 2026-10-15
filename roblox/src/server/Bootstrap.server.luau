--!strict
-- Entry point (Script). Creates the RemoteEvents, then starts the server services in a fixed order.
-- Remotes: ReplicatedStorage.Remotes.ActionRequest (client -> server intent), ActionResult (server -> client).

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Server = script.Parent

local remotes = ReplicatedStorage:FindFirstChild("Remotes")
if not remotes then
	remotes = Instance.new("Folder")
	remotes.Name = "Remotes"
	remotes.Parent = ReplicatedStorage
end
local function remote(name: string): RemoteEvent
	local r = remotes:FindFirstChild(name)
	if not r then
		r = Instance.new("RemoteEvent")
		r.Name = name
		r.Parent = remotes
	end
	return r :: RemoteEvent
end

local actionRequest = remote("ActionRequest")
local actionResult = remote("ActionResult")

local Config = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Config"))

-- Combat (sword, slimes, damage) is a feature switch: Config.features.combat. Off = none of these services start.
if Config.features.combat then
	require(Server:WaitForChild("PlayerService")).start()
	require(Server:WaitForChild("EnemyService")).start()
	require(Server:WaitForChild("CombatService")).start(actionRequest, actionResult)
else
	print("[EchoAtlas] combat is OFF (Config.features.combat = false): no sword, no slimes")
end
require(Server:WaitForChild("GateService")).start()

ReplicatedStorage:SetAttribute("ServerReady", true)
print("[EchoAtlas] server ready")

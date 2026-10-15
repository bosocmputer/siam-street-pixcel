--!nonstrict
-- Builds the combat-slice prefabs in ServerStorage.EchoAtlas.Prefabs from vetted Creator Store assets that were
-- inserted into ServerStorage.AssetQuarantine with insert_asset (ids and verdicts: roblox/assets/third-party-assets.md):
--   TrainingSword  <- SwordWood_105611637318886  (MeshPart wooden sword, scripts stripped, trail attachments added)
--   SlimeVisual    <- SlimeBlob_5664971967       (glossy jelly dome, rig/AI/animation stripped, recoloured to rain-blue)
-- Run: require(<this ModuleScript>)() in Edit mode. Missing sources are skipped and reported.
-- (The older prefabs - PolePair, TreeRain, StreetTreeA/B, TukTuk, Scooter, TrashCan - were built with equivalent
-- one-off scripts; their recipe is described in roblox/assets/third-party-assets.md.)

return function()
	local SS = game:GetService("ServerStorage")
	local quarantine = SS:FindFirstChild("AssetQuarantine")
	local root = SS:FindFirstChild("EchoAtlas") or Instance.new("Folder")
	root.Name = "EchoAtlas"
	root.Parent = SS
	local prefabs = root:FindFirstChild("Prefabs") or Instance.new("Folder")
	prefabs.Name = "Prefabs"
	prefabs.Parent = root
	local report = {}

	local function strip(inst)
		for _, d in inst:GetDescendants() do
			if d:IsA("LuaSourceContainer") or d:IsA("Camera") or d:IsA("Humanoid") or d:IsA("Animator") or d:IsA("Animation")
				or d:IsA("KeyframeSequence") or d:IsA("Smoke") or d:IsA("Motor6D") or d:IsA("Weld") then
				d:Destroy()
			end
		end
	end

	-- Training sword -------------------------------------------------------------------------------------------
	local srcSword = quarantine and quarantine:FindFirstChild("SwordWood_105611637318886")
	if srcSword then
		local mesh = srcSword:FindFirstChildOfClass("MeshPart")
		local model = Instance.new("Model")
		model.Name = "TrainingSword"
		local blade = mesh:Clone()
		blade.Name = "Blade"
		strip(blade)
		blade.Anchored = false
		blade.CanCollide = false
		blade.CanQuery = false
		blade.CanTouch = false
		blade.Massless = true
		blade.Parent = model
		model.PrimaryPart = blade
		-- the mesh runs along local Y: hilt at -Y, point at +Y (verified from the asset thumbnail)
		local half = blade.Size.Y / 2
		local a0 = Instance.new("Attachment")
		a0.Name = "TrailTip"
		a0.Position = Vector3.new(0, half * 0.95, 0)
		a0.Parent = blade
		local a1 = Instance.new("Attachment")
		a1.Name = "TrailMid"
		a1.Position = Vector3.new(0, half * 0.1, 0)
		a1.Parent = blade
		local trail = Instance.new("Trail")
		trail.Name = "SwingTrail"
		trail.Attachment0, trail.Attachment1 = a0, a1
		trail.Lifetime = 0.22
		trail.MinLength = 0.05
		trail.FaceCamera = true
		trail.LightEmission = 0.65
		trail.LightInfluence = 0
		trail.Color = ColorSequence.new({ ColorSequenceKeypoint.new(0, Color3.fromHex("FFFFFF")), ColorSequenceKeypoint.new(0.4, Color3.fromHex("79DDE8")), ColorSequenceKeypoint.new(1, Color3.fromHex("2F6F8F")) })
		trail.Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.15), NumberSequenceKeypoint.new(1, 1) })
		trail.WidthScale = NumberSequence.new({ NumberSequenceKeypoint.new(0, 1), NumberSequenceKeypoint.new(1, 0.2) })
		trail.Enabled = false
		trail.Parent = blade
		local old = prefabs:FindFirstChild("TrainingSword")
		if old then
			old:Destroy()
		end
		model.Parent = prefabs
		report.TrainingSword = string.format("%.2f x %.2f x %.2f studs", blade.Size.X, blade.Size.Y, blade.Size.Z)
	end

	-- Slime visual ---------------------------------------------------------------------------------------------
	local srcSlime = quarantine and quarantine:FindFirstChild("SlimeBlob_5664971967")
	if srcSlime then
		local model = srcSlime:Clone()
		model.Name = "SlimeVisual"
		strip(model)
		-- flatten: keep only the parts, directly under the model
		local rootPart
		for _, d in model:GetDescendants() do
			if d:IsA("BasePart") and d.Name == "HumanoidRootPart" then
				rootPart = d
			end
		end
		local keep = {}
		for _, d in model:GetDescendants() do
			if d:IsA("BasePart") then
				table.insert(keep, d)
			end
		end
		for _, p in keep do
			p.Parent = model
		end
		for _, c in model:GetChildren() do
			if c:IsA("Model") or c:IsA("Folder") then
				c:Destroy()
			end
		end
		model.PrimaryPart = rootPart
		local blue, deep = Color3.fromHex("79DDE8"), Color3.fromHex("2B86A8")
		for _, p in model:GetChildren() do
			if p:IsA("BasePart") then
				p.Anchored = true
				p.CanCollide = false
				p.CanTouch = false
				p.CanQuery = (p.Name == "Body" or p.Name == "Head") -- the player's hit query finds these only
				p.CastShadow = false
				if p.Name == "Head" or p.Name == "Body" then
					p.Color = deep
				elseif p.Name == "HeadSlime" or p.Name == "BodySlime" then
					p.Color = blue
				end
			end
		end
		model.WorldPivot = rootPart.CFrame
		local old = prefabs:FindFirstChild("SlimeVisual")
		if old then
			old:Destroy()
		end
		model.Parent = prefabs
		local cf, size = model:GetBoundingBox()
		report.SlimeVisual = string.format("%.2f x %.2f x %.2f studs, parts=%d", size.X, size.Y, size.Z, #model:GetChildren())
	end
	return report
end

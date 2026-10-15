-- Run through the Studio MCP execute_luau (Edit datamodel) while `python -I -m http.server 8765 --bind 127.0.0.1`
-- is serving the roblox/ folder. Copies every file in roblox/src/manifest.json into Studio (repo -> Studio, one way).
-- It destroys and recreates each script so require() never serves a stale cached module.
local HttpService = game:GetService("HttpService")
HttpService.HttpEnabled = true
local BASE = "http://127.0.0.1:8765/"
local manifest = HttpService:JSONDecode(HttpService:GetAsync(BASE .. "src/manifest.json", true))

local function ensurePath(path: string): Instance
	local segs = string.split(path, "/")
	local cur: Instance = game:GetService(segs[1])
	for i = 2, #segs do
		local nxt = cur:FindFirstChild(segs[i])
		if not nxt then
			nxt = Instance.new("Folder")
			nxt.Name = segs[i]
			nxt.Parent = cur
		end
		cur = nxt
	end
	return cur
end

local function put(entry): string
	local src = HttpService:GetAsync(BASE .. entry.path, true)
	local parent = ensurePath(entry.parent)
	local old = parent:FindFirstChild(entry.name)
	if old then
		old:Destroy()
	end
	local inst = Instance.new(entry.class)
	inst.Name = entry.name
	inst.Source = src
	inst.Parent = parent
	return entry.parent .. "/" .. entry.name
end

local done = {}
for _, e in manifest.files do
	table.insert(done, put(e))
end
for _, e in manifest.tests do
	table.insert(done, put(e))
end
return done

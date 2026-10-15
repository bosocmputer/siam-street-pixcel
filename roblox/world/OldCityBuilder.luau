--!strict
-- Chiang Mai old city ROADS + SIDEWALKS, V3 (hybrid): the surfaces are the Roblox city template's OWN meshes (road_straight,
-- sidewalk, t_intersection, 4way_intersection, Crosswalk_01_A) laid along the real road centre lines; plain Parts are used ONLY
-- as connectors where the template has no piece (outer notch of a bend, oblique junction disc). No Place2 code or data.
-- Data: OldCityRoads.luau (OpenFreeMap tiles via tools/roblox/gen_oldcity_roads.py). Run in Studio EDIT mode (Studio MCP).
-- Bends: asphalt overshoots by half a road width, the INNER sidewalk is trimmed, the OUTER notch is filled by a plain paving
-- block; overlapping parts get tiny height offsets so nothing flickers. Right-angle junctions use the template T / 4-way piece.
-- Re-runnable: Builder.clear() removes ChiangMaiOldCity. Scales are ESTIMATES; road centre lines are MAPPED.
-- Scale: 1 stud = 0.28 m (docs/roblox/04-real-world-map.md §6), converted in ONE place (toStud).

local Workspace = game:GetService("Workspace")

local Builder = {}

local STUD = 0.28
-- local (0,0) = moat centre. The Tha Phae pilot (local ~802, 83) sits just EAST of the template: template Parts end at
-- x = 963 but its TERRAIN reaches x = 1252 (raycast, z -320..920), so the patch must start at x >= 1300 -> (-974, 0, 4).
-- If the whole moat rectangle is built later its west part would overlap the template: choose ORIGIN again then.
local ORIGIN = Vector3.new(-974, 0, 4)

local CLASS_SCALE: { [string]: number } = { t = 1.0, p = 1.0, s = 0.7, r = 0.6, m = 0.5, v = 0.33 }
local CLASS_RANK: { [string]: number } = { v = 1, m = 2, r = 3, s = 4, p = 5, t = 6 }
local HAS_SIDEWALK: { [string]: boolean } = { t = true, p = true, s = true, r = true, m = true, v = false }
local ARM = 45 -- studs from the centre of a template intersection piece to its edge, at scale 1
local ROAD_LEN = 22.5 -- along-road length of the template straight pieces at scale 1
local SIDE_TOP = 1.68 -- template sidewalk height at scale 1
local ASPHALT_COLOR = Color3.fromRGB(88, 86, 92)
local PAVING_COLOR = Color3.fromRGB(176, 170, 160)

type Proto = { part: MeshPart, rel: CFrame }
local Data: any
local root: Folder
local folders: { [string]: Folder } = {}
local kit: { road: Proto, left: Proto, right: Proto, tee: Model, cross: Model, crosswalk: MeshPart }?

local function toStud(x: number, z: number): Vector3
	return Vector3.new(ORIGIN.X + x / STUD, 0, ORIGIN.Z + z / STUD)
end

local function getKit()
	if kit then
		return kit
	end
	local streets = (Workspace:FindFirstChild("Endorsed Models") :: Instance):FindFirstChild("Streets") :: Instance
	local sm = ((Workspace:FindFirstChild("City_Template") :: Instance):FindFirstChild("Streets_Sidewalks") :: Instance):FindFirstChild("StreetMeshes") :: Instance
	local mod = streets:FindFirstChild("Road_Straight_90x22.5") :: Model
	local cf0 = mod:GetBoundingBox()
	local road, left, right
	for _, d in mod:GetDescendants() do
		if d:IsA("MeshPart") then
			local rel = cf0:ToObjectSpace(d.CFrame)
			if d.Name == "road_straight" then
				road = { part = d, rel = rel }
			elseif rel.Position.X < 0 then
				left = { part = d, rel = rel }
			else
				right = { part = d, rel = rel }
			end
		end
	end
	local cw = (streets:FindFirstChild("Road_Intersection_4x") :: Instance):FindFirstChild("Crosswalk_01_A") :: MeshPart
	kit = {
		road = road :: Proto,
		left = left :: Proto,
		right = right :: Proto,
		tee = sm:FindFirstChild("t_intersection") :: Model,
		cross = sm:FindFirstChild("4way_intersection") :: Model,
		crosswalk = cw,
	}
	return kit :: any
end

function Builder.init(data: any)
	Data = data
	root = Workspace:FindFirstChild("ChiangMaiOldCity") :: Folder
	if not root then
		root = Instance.new("Folder")
		root.Name = "ChiangMaiOldCity"
		root.Parent = Workspace
	end
	root:SetAttribute("originStud", ORIGIN)
	root:SetAttribute("studPerMetre", 1 / STUD)
	root:SetAttribute("geometryStatus", "mapped road lines; template meshes, scales estimated")
	root:SetAttribute("rightsStatus", "pending-review (ODbL + OpenMapTiles attribution)")
	for _, name in { "Ground", "Roads", "Sidewalks", "Junctions", "Connectors", "Marks" } do
		local f = root:FindFirstChild(name) :: Folder
		if not f then
			f = Instance.new("Folder")
			f.Name = name
			f.Parent = root
		end
		folders[name] = f
	end
end

function Builder.clear()
	local o = Workspace:FindFirstChild("ChiangMaiOldCity")
	if o then
		o:Destroy()
	end
end

-- Flat ground under a square patch (centre cx,cz metres, half metres), top face at y = 0.
function Builder.groundPatch(cx: number, cz: number, half: number)
	local size = (half * 2 + 30) / STUD
	local p = Instance.new("Part")
	p.Name = "GroundPatch"
	p.Anchored = true
	p.Size = Vector3.new(size, 4, size)
	local c = toStud(cx, cz)
	p.CFrame = CFrame.new(c.X, -2, c.Z)
	p.Color = Color3.fromRGB(150, 146, 136)
	p.Material = Enum.Material.Concrete
	p.CastShadow = false
	p.Parent = folders.Ground
end

local function rightOf(dir: Vector3): Vector3
	return Vector3.new(-dir.Z, 0, dir.X)
end

-- One template mesh slice along a segment: base = segment start, dir = unit heading, [z0, z1] = range along dir.
-- Uniform scale s for width/height; the along-road size is stretched to fit the range.
local function slice(parent: Instance, proto: Proto, s: number, base: Vector3, dir: Vector3, z0: number, z1: number, lift: number)
	local len = z1 - z0
	if len < 0.2 then
		return
	end
	local mid = base + dir * ((z0 + z1) / 2)
	local frame = CFrame.lookAt(mid, mid + dir)
	local rel = proto.rel
	local offset = Vector3.new(rel.Position.X * s, rel.Position.Y * s + 0.84 * s + lift, 0)
	local p = proto.part:Clone()
	p.Size = Vector3.new(proto.part.Size.X * s, proto.part.Size.Y * s, len)
	p.CFrame = frame * CFrame.new(offset) * (rel - rel.Position)
	p.Anchored = true
	p.CastShadow = false
	p.Parent = parent
end

-- Fill [z0, z1] with slices of about one template module each.
local function slices(parent: Instance, proto: Proto, s: number, base: Vector3, dir: Vector3, z0: number, z1: number, lift: number): number
	local len = z1 - z0
	if len < 0.4 then
		return 0
	end
	local n = math.max(1, math.floor(len / (ROAD_LEN * s) + 0.5))
	local step = len / n
	for i = 0, n - 1 do
		slice(parent, proto, s, base, dir, z0 + i * step, z0 + (i + 1) * step, lift)
	end
	return n
end

-- plain paving block (connector): lateral offset along rightOf(dir), width w, height h, along [z0,z1]
local function paving(parent: Instance, base: Vector3, dir: Vector3, lateral: number, w: number, h: number, z0: number, z1: number, lift: number)
	if z1 - z0 < 0.3 then
		return
	end
	local mid = base + dir * ((z0 + z1) / 2) + rightOf(dir) * lateral
	local p = Instance.new("Part")
	p.Name = "NotchFill"
	p.Anchored = true
	p.Size = Vector3.new(w, h, z1 - z0)
	p.CFrame = CFrame.lookAt(Vector3.new(mid.X, h / 2 + lift, mid.Z), Vector3.new(mid.X, h / 2 + lift, mid.Z) + dir)
	p.Color = PAVING_COLOR
	p.Material = Enum.Material.Concrete
	p.MaterialVariant = "Sidewalk_A"
	p.CastShadow = false
	p.Parent = parent
end

local function placeWhole(model: Model, target: CFrame)
	local cf = model:GetBoundingBox()
	local pivotRel = cf:ToObjectSpace(model:GetPivot())
	model:PivotTo(target * pivotRel)
end

function Builder.pilot(cx: number, cz: number, half: number): { [string]: any }
	local K = getKit()
	local lim = half + 10
	local function key(x: number, z: number): string
		return string.format("%d,%d", math.floor(x + 0.5), math.floor(z + 0.5))
	end
	local pos: { [string]: Vector2 } = {}
	local adj: { [string]: { [string]: string } } = {}
	local function addEdge(ax: number, az: number, bx: number, bz: number, c: string)
		local ka, kb = key(ax, az), key(bx, bz)
		if ka == kb then
			return
		end
		pos[ka] = pos[ka] or Vector2.new(ax, az)
		pos[kb] = pos[kb] or Vector2.new(bx, bz)
		adj[ka] = adj[ka] or {}
		adj[kb] = adj[kb] or {}
		local old = adj[ka][kb]
		if not old or CLASS_RANK[c] > CLASS_RANK[old] then
			adj[ka][kb] = c
			adj[kb][ka] = c
		end
	end
	local function clip(ax: number, az: number, bx: number, bz: number): { number }?
		local t0, t1 = 0, 1
		local dx, dz = bx - ax, bz - az
		local function test(p: number, q: number): boolean
			if p == 0 then
				return q >= 0
			end
			local r = q / p
			if p < 0 then
				if r > t1 then
					return false
				end
				t0 = math.max(t0, r)
			else
				if r < t0 then
					return false
				end
				t1 = math.min(t1, r)
			end
			return true
		end
		if test(-dx, ax - (cx - lim)) and test(dx, (cx + lim) - ax) and test(-dz, az - (cz - lim)) and test(dz, (cz + lim) - az) and t1 > t0 then
			return { ax + t0 * dx, az + t0 * dz, ax + t1 * dx, az + t1 * dz }
		end
		return nil
	end
	for _, r in Data.roads do
		local p = r.p
		for k = 1, #p - 3, 2 do
			local seg = clip(p[k], p[k + 1], p[k + 2], p[k + 3])
			if seg then
				addEdge(seg[1], seg[2], seg[3], seg[4], r.c)
			end
		end
	end

	local function neighbors(k: string): { string }
		local out = {}
		for n in adj[k] do
			table.insert(out, n)
		end
		return out
	end
	local function nodeScale(k: string): number
		local best = 0.33
		for _, c in adj[k] do
			best = math.max(best, CLASS_SCALE[c])
		end
		return best
	end

	local stats = { chains = 0, roadSlices = 0, sideSlices = 0, notchFills = 0, templateJunctions = 0, discJunctions = 0, crosswalks = 0, discList = {} :: { string } }

	-- junction decision: template piece when the arms are close to right angles, otherwise a connector disc
	-- trimSide[neighbour] = distance from the node at which that arm's raised sidewalk may start
	type Junction = { template: boolean, trim: number, trimSide: { [string]: number } }
	local junction: { [string]: Junction } = {}
	for k in adj do
		local nb = neighbors(k)
		if #nb >= 3 then
			local s = nodeScale(k)
			local angs = {}
			for _, q in nb do
				local b = (pos[q] - pos[k]).Unit
				table.insert(angs, math.atan2(b.Y, b.X))
			end
			table.sort(angs)
			local worst = 0
			for i = 1, #angs do
				local g = math.deg((angs[i % #angs + 1] - angs[i]) % (2 * math.pi))
				local dev = math.min(math.abs(g - 90), math.abs(g - 180), math.abs(g - 270))
				worst = math.max(worst, dev)
			end
			local c3 = toStud(pos[k].X, pos[k].Y)
			if #nb <= 4 and worst <= 20 then
				-- template piece
				local orient: CFrame
				local which: "tee" | "cross"
				if #nb == 3 then
					which = "tee"
					local gaps = { angs[2] - angs[1], angs[3] - angs[2], angs[1] + 2 * math.pi - angs[3] }
					local bestI, bestSum = 1, math.huge
					for i = 1, 3 do
						local sum = gaps[(i + 1) % 3 + 1] + gaps[i]
						if sum < bestSum then
							bestSum, bestI = sum, i
						end
					end
					local d = Vector3.new(math.cos(angs[bestI]), 0, math.sin(angs[bestI]))
					orient = CFrame.lookAt(Vector3.zero, d) * CFrame.Angles(0, math.rad(-90), 0)
				else
					which = "cross"
					local sx, sy = 0, 0
					for _, a in angs do
						sx += math.cos(4 * a)
						sy += math.sin(4 * a)
					end
					local a0 = math.atan2(sy, sx) / 4
					orient = CFrame.lookAt(Vector3.zero, Vector3.new(math.cos(a0), 0, math.sin(a0)))
				end
				local m = K[which]:Clone()
				m:ScaleTo(s)
				placeWhole(m, CFrame.new(c3.X, 0.84 * s, c3.Z) * orient)
				for _, d in m:GetDescendants() do
					if d:IsA("BasePart") then
						d.Anchored = true
					end
				end
				m.Parent = folders.Junctions
				local ts: { [string]: number } = {}
				for _, q in nb do
					ts[q] = ARM * s
				end
				junction[k] = { template = true, trim = ARM * s, trimSide = ts }
				stats.templateJunctions += 1
			else
				-- connector disc (no template piece fits)
				local R = 22.5 * s * 1.15
				local p = Instance.new("Part")
				p.Name = "JunctionDisc"
				p.Shape = Enum.PartType.Cylinder
				p.Anchored = true
				local th = 1.0 * s
				p.Size = Vector3.new(th, 2 * R, 2 * R)
				p.CFrame = CFrame.new(c3.X, th / 2 + 0.01, c3.Z) * CFrame.Angles(0, 0, math.rad(90))
				p.Color = ASPHALT_COLOR
				p.Material = Enum.Material.Asphalt
				p.CastShadow = false
				p.Parent = folders.Connectors
				-- sidewalks start where this arm's corridor no longer overlaps the neighbouring arms' corridors
				local ts: { [string]: number } = {}
				local minAng: { [string]: number } = {}
				for _, q in nb do
					local d1 = (pos[q] - pos[k]).Unit
					local cha = (22.5 + (HAS_SIDEWALK[adj[k][q]] and 22.5 or 0)) * CLASS_SCALE[adj[k][q]]
					local need = R * 1.05
					local smallest = math.pi
					for _, o in nb do
						if o ~= q then
							local d2 = (pos[o] - pos[k]).Unit
							local phi = math.acos(math.clamp(d1:Dot(d2), -1, 1))
							smallest = math.min(smallest, phi)
							local cho = (22.5 + (HAS_SIDEWALK[adj[k][o]] and 22.5 or 0)) * CLASS_SCALE[adj[k][o]]
							local sep = (cha + cho) / (2 * math.max(math.sin(phi / 2), 0.12))
							need = math.max(need, math.min(sep, 150))
						end
					end
					ts[q] = need
					minAng[q] = math.deg(smallest)
				end
				junction[k] = { template = false, trim = 0, trimSide = ts }
				stats.discJunctions += 1
				table.insert(stats.discList, k)
				-- crosswalks on the arms of a disc junction (template mesh), only where the arm is not squeezed by another
				for _, q in nb do
					local c = adj[k][q]
					if c ~= "v" and minAng[q] >= 50 then
						local d2 = (pos[q] - pos[k]).Unit
						local sc = CLASS_SCALE[c]
						local dir = Vector3.new(d2.X, 0, d2.Y)
						local centre = c3 + dir * (R + 7 * sc)
						local cw = K.crosswalk:Clone()
						cw.Anchored = true
						cw.CanCollide = false
						cw.CastShadow = false
						cw.Size = cw.Size * sc * (45 / 43.4)
						cw.CFrame = CFrame.lookAt(Vector3.new(centre.X, 1.0 * sc + 0.05, centre.Z), Vector3.new(centre.X, 1.0 * sc + 0.05, centre.Z) + dir) * CFrame.Angles(0, math.rad(90), 0)
						cw.Parent = folders.Marks
						stats.crosswalks += 1
					end
				end
			end
		end
	end

	-- chains between terminal nodes (junctions and dead ends); bends are handled per vertex
	local visited: { [string]: boolean } = {}
	local function ekey(a: string, b: string): string
		return if a < b then a .. "|" .. b else b .. "|" .. a
	end
	local chainIndex = 0
	for startK in adj do
		local nbStart = neighbors(startK)
		if #nbStart ~= 2 then
			for _, first in nbStart do
				if not visited[ekey(startK, first)] then
					local path = { startK }
					local rank = CLASS_RANK[adj[startK][first]]
					local prev, cur = startK, first
					visited[ekey(prev, cur)] = true
					table.insert(path, cur)
					while #neighbors(cur) == 2 do
						local nxt: string? = nil
						for _, n in neighbors(cur) do
							if n ~= prev then
								nxt = n
							end
						end
						if not nxt then
							break
						end
						rank = math.max(rank, CLASS_RANK[adj[cur][nxt]])
						visited[ekey(cur, nxt)] = true
						prev, cur = cur, nxt
						table.insert(path, cur)
					end
					local cls = "v"
					for c, r in CLASS_RANK do
						if r == rank then
							cls = c
						end
					end
					chainIndex += 1
					stats.chains += 1
					local s = CLASS_SCALE[cls]
					local rh, sw = 22.5 * s, HAS_SIDEWALK[cls] and 22.5 * s or 0
					local pts: { Vector3 } = {}
					for i, k in path do
						pts[i] = toStud(pos[k].X, pos[k].Y)
					end
					local n = #pts - 1
					local jStart, jEnd = junction[path[1]], junction[path[#path]]
					-- cumulative distance along the chain, so junction trims apply across several short segments
					local cum: { number } = { 0 }
					for i = 2, #pts do
						cum[i] = cum[i - 1] + (pts[i] - pts[i - 1]).Magnitude
					end
					local total = cum[#cum]
					local roadFrom = (jStart and jStart.template) and jStart.trim or 0
					local roadTo = total - ((jEnd and jEnd.template) and jEnd.trim or 0)
					local sideFrom = jStart and (jStart.trimSide[path[2]] or 0) or 0
					local sideTo = total - (jEnd and (jEnd.trimSide[path[#path - 1]] or 0) or 0)

					-- turn data at interior vertices (index 2..n): angle and which side is inner (+1 = right)
					local function bendAt(v: number): (number, number)
						local d1, d2 = (pts[v] - pts[v - 1]).Unit, (pts[v + 1] - pts[v]).Unit
						local turn = d1.X * d2.Z - d1.Z * d2.X
						local ang = math.acos(math.clamp(d1:Dot(d2), -1, 1))
						return ang, (turn > 0) and 1 or -1
					end

					for i = 1, n do
						local a, b = pts[i], pts[i + 1]
						local L = (b - a).Magnitude
						if L > 0.05 then
							local dir = (b - a) / L
							-- asphalt range: overshoot at bends, start at the template piece edge, run to the node at a disc
							local r0, r1 = 0, L
							if i > 1 then
								r0 = -rh
							end
							if i < n then
								r1 = L + rh
							end
							-- junction trims (template piece edge) measured along the whole chain
							r0 = math.max(r0, roadFrom - cum[i])
							r1 = math.min(r1, roadTo - cum[i])
							local lift = ((chainIndex * 5 + i) % 3) * 0.012
							stats.roadSlices += slices(folders.Roads, K.road, s, a, dir, r0, r1, lift)
							-- sidewalks
							if sw > 0 then
								for _, sigma in { -1, 1 } do
									local z0, z1 = 0, L
									local startAtBend = i > 1
									local endAtBend = i < n
									if startAtBend then
										local ang, inner = bendAt(i)
										if sigma == inner then
											z0 = math.min((rh + sw) * math.tan(ang / 2), 0.45 * L)
										else
											z0 = 0
											paving(folders.Connectors, a, dir, sigma * (rh + sw / 2), sw, SIDE_TOP * s - 0.02, -(rh + sw), 0, 0.004)
											stats.notchFills += 1
										end
									end
									if endAtBend then
										local ang, inner = bendAt(i + 1)
										if sigma == inner then
											z1 = L - math.min((rh + sw) * math.tan(ang / 2), 0.45 * L)
										else
											z1 = L
											paving(folders.Connectors, a, dir, sigma * (rh + sw / 2), sw, SIDE_TOP * s - 0.02, L, L + (rh + sw), 0.004)
											stats.notchFills += 1
										end
									end
									-- junction trims measured along the whole chain
									z0 = math.max(z0, sideFrom - cum[i])
									z1 = math.min(z1, sideTo - cum[i])
									local proto = if sigma > 0 then K.right else K.left
									stats.sideSlices += slices(folders.Sidewalks, proto, s, a, dir, z0, z1, lift)
								end
							end
						end
					end
				end
			end
		end
	end
	return stats
end

return Builder

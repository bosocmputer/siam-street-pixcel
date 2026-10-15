--!nonstrict
-- Tha Phae graybox+ builder. Reads ThapaeData (metres, X east, Z south) and builds a walkable, detailed
-- neighbourhood into Workspace.ThapaeWorld in EDIT mode. Re-runnable: Builder.clear() removes the old world.
-- Units: ALL geometry here is in METRES; the single metre->stud conversion happens in `place()` (1 stud = 0.28 m).
-- Mapped (OSM): footprints, road/sidewalk/crossing lines, moat, wall, trees. Estimated: heights, roofs, windows,
-- shopfronts, awnings, lane widths/markings, lamps. Nothing here is a survey or a digital twin.
local Workspace = game:GetService("Workspace")
local Lighting = game:GetService("Lighting")

local STUD = 0.28
local Builder = {}
local Data
local root
local folders = {}
local counter = 0
local occ: { { x: number, z: number, r: number, tag: string } } = {}
local canPlace, claim, releaseTag, placeOk, placeOrientedOk -- assigned below (placement registry)

local NOCOLLIDE = { CanCollide = false, CanTouch = false, CanQuery = false, CastShadow = false }

-- ---------------------------------------------------------------- helpers
local function tick()
	counter += 1
	if counter % 500 == 0 then
		task.wait()
	end
end

local function rnd(id: number, salt: number): number
	local x = math.sin(id * 12.9898 + salt * 78.233) * 43758.5453
	return x - math.floor(x)
end

local function pick(list, id, salt)
	return list[math.floor(rnd(id, salt) * #list) % #list + 1]
end

-- cfM / sizeM in metres -> studs (the one conversion boundary)
local function place(inst: BasePart, sizeM: Vector3, cfM: CFrame, color: Color3, mat: Enum.Material, parent: Instance, opts)
	inst.Anchored = true
	inst.Size = sizeM / STUD
	inst.CFrame = CFrame.new(cfM.Position / STUD) * cfM.Rotation
	inst.Color = color
	inst.Material = mat
	inst.TopSurface = Enum.SurfaceType.Smooth
	inst.BottomSurface = Enum.SurfaceType.Smooth
	if opts then
		for k, v in opts do
			(inst :: any)[k] = v
		end
	end
	inst.Parent = parent
	tick()
	return inst
end

local function box(parent, sizeM, cfM, color, mat, opts)
	return place(Instance.new("Part"), sizeM, cfM, color, mat, parent, opts)
end

local function wedgeP(parent, sizeM, cfM, color, mat, opts)
	return place(Instance.new("WedgePart"), sizeM, cfM, color, mat, parent, opts)
end

local function cylinderUp(parent, diameterM, heightM, posM, color, mat, opts)
	local p = Instance.new("Part")
	p.Shape = Enum.PartType.Cylinder
	return place(p, Vector3.new(heightM, diameterM, diameterM), CFrame.new(posM) * CFrame.Angles(0, 0, math.rad(90)), color, mat, parent, opts)
end

local function ball(parent, diameterM, posM, color, mat, opts)
	local p = Instance.new("Part")
	p.Shape = Enum.PartType.Ball
	return place(p, Vector3.new(diameterM, diameterM, diameterM), CFrame.new(posM), color, mat, parent, opts)
end

-- Triangular prism between 3D points a,b,c (metres) with thickness t (metres) centred on the triangle plane.
local function triPrism(parent, a: Vector3, b: Vector3, c: Vector3, t: number, color, mat, opts)
	local ab, ac, bc = b - a, c - a, c - b
	local abd, acd, bcd = ab:Dot(ab), ac:Dot(ac), bc:Dot(bc)
	if abd > acd and abd > bcd then
		c, a = a, c
	elseif acd > bcd and acd > abd then
		a, b = b, a
	end
	ab, ac, bc = b - a, c - a, c - b
	local crossv = ac:Cross(ab)
	if crossv.Magnitude < 1e-6 then
		return
	end
	local right = crossv.Unit
	local up = bc:Cross(right).Unit
	local back = bc.Unit
	local height = math.abs(ab:Dot(up))
	local l1, l2 = math.abs(ab:Dot(back)), math.abs(ac:Dot(back))
	if height < 1e-3 then
		return
	end
	if l1 > 1e-3 then
		wedgeP(parent, Vector3.new(t, height, l1), CFrame.fromMatrix((a + b) / 2, right, up, back), color, mat, opts)
	end
	if l2 > 1e-3 then
		wedgeP(parent, Vector3.new(t, height, l2), CFrame.fromMatrix((a + c) / 2, -right, up, -back), color, mat, opts)
	end
end

local function toVec2List(flat: { number }): { Vector2 }
	local out = {}
	for i = 1, #flat - 1, 2 do
		local v = Vector2.new(flat[i], flat[i + 1])
		local last = out[#out]
		if not last or (last - v).Magnitude > 0.05 then
			table.insert(out, v)
		end
	end
	if #out > 2 and (out[1] - out[#out]).Magnitude < 0.05 then
		table.remove(out)
	end
	return out
end

local function polyArea(p: { Vector2 }): number
	local a = 0
	for i = 1, #p do
		local q = p[i % #p + 1]
		a += p[i].X * q.Y - q.X * p[i].Y
	end
	return a / 2
end

local function pointInPoly(x: number, z: number, p: { Vector2 }): boolean
	local ins = false
	local j = #p
	for i = 1, #p do
		local pi, pj = p[i], p[j]
		if (pi.Y > z) ~= (pj.Y > z) and x < (pj.X - pi.X) * (z - pi.Y) / (pj.Y - pi.Y) + pi.X then
			ins = not ins
		end
		j = i
	end
	return ins
end

local function pointInTri(p: Vector2, a: Vector2, b: Vector2, c: Vector2): boolean
	local function sgn(p1: Vector2, p2: Vector2, p3: Vector2)
		return (p1.X - p3.X) * (p2.Y - p3.Y) - (p2.X - p3.X) * (p1.Y - p3.Y)
	end
	local d1, d2, d3 = sgn(p, a, b), sgn(p, b, c), sgn(p, c, a)
	local neg = d1 < -1e-9 or d2 < -1e-9 or d3 < -1e-9
	local pos = d1 > 1e-9 or d2 > 1e-9 or d3 > 1e-9
	return not (neg and pos) and not (not neg and not pos)
end

-- Ear clipping. Returns index triples; polygon may be CW or CCW.
local function triangulate(poly: { Vector2 }): { { number } }
	local n = #poly
	local idx = {}
	for i = 1, n do
		idx[i] = i
	end
	if polyArea(poly) < 0 then
		for i = 1, n // 2 do
			idx[i], idx[n - i + 1] = idx[n - i + 1], idx[i]
		end
	end
	local tris = {}
	local guard = 0
	while #idx > 3 and guard < 3000 do
		guard += 1
		local clipped = false
		local m = #idx
		for k = 1, m do
			local i0, i1, i2 = idx[(k - 2) % m + 1], idx[k], idx[k % m + 1]
			local a, b, c = poly[i0], poly[i1], poly[i2]
			local cr = (b.X - a.X) * (c.Y - a.Y) - (b.Y - a.Y) * (c.X - a.X)
			if cr > 1e-9 then
				local ear = true
				for _, j in idx do
					if j ~= i0 and j ~= i1 and j ~= i2 and pointInTri(poly[j], a, b, c) then
						ear = false
						break
					end
				end
				if ear then
					table.insert(tris, { i0, i1, i2 })
					table.remove(idx, k)
					clipped = true
					break
				end
			end
		end
		if not clipped then
			break
		end
	end
	if #idx == 3 then
		table.insert(tris, { idx[1], idx[2], idx[3] })
	elseif #idx > 3 then
		for k = 2, #idx - 1 do
			table.insert(tris, { idx[1], idx[k], idx[k + 1] })
		end
	end
	return tris
end

-- Extrude a footprint between y0 and y0+h (metres) using triangle prisms.
local function extrude(parent, poly: { Vector2 }, y0: number, h: number, color, mat, opts)
	local ym = y0 + h / 2
	for _, t in triangulate(poly) do
		local a, b, c = poly[t[1]], poly[t[2]], poly[t[3]]
		triPrism(parent, Vector3.new(a.X, ym, a.Y), Vector3.new(b.X, ym, b.Y), Vector3.new(c.X, ym, c.Y), h, color, mat, opts)
	end
end

-- Minimum-area bounding rectangle. Returns centre (x,z), long-axis unit (ux,uz), long length L, short width W.
local function minRect(poly: { Vector2 })
	local best
	for i = 1, #poly do
		local a, b = poly[i], poly[i % #poly + 1]
		local d = b - a
		if d.Magnitude > 0.2 then
			local ux, uz = d.X / d.Magnitude, d.Y / d.Magnitude
			local minU, maxU, minV, maxV = math.huge, -math.huge, math.huge, -math.huge
			for _, p in poly do
				local u = (p.X - a.X) * ux + (p.Y - a.Y) * uz
				local v = -(p.X - a.X) * uz + (p.Y - a.Y) * ux
				minU, maxU, minV, maxV = math.min(minU, u), math.max(maxU, u), math.min(minV, v), math.max(maxV, v)
			end
			local area = (maxU - minU) * (maxV - minV)
			if not best or area < best.area then
				local cu, cv = (minU + maxU) / 2, (minV + maxV) / 2
				best = {
					area = area,
					cx = a.X + cu * ux - cv * uz,
					cz = a.Y + cu * uz + cv * ux,
					ux = ux,
					uz = uz,
					L = maxU - minU,
					W = maxV - minV,
				}
			end
		end
	end
	if best and best.W > best.L then
		best.ux, best.uz = -best.uz, best.ux
		best.L, best.W = best.W, best.L
	end
	return best
end

local function segDist(px, pz, ax, az, bx, bz): number
	local dx, dz = bx - ax, bz - az
	local l2 = dx * dx + dz * dz
	local t = l2 > 0 and math.clamp(((px - ax) * dx + (pz - az) * dz) / l2, 0, 1) or 0
	local qx, qz = ax + t * dx, az + t * dz
	return math.sqrt((px - qx) ^ 2 + (pz - qz) ^ 2)
end

-- ---------------------------------------------------------------- palette
local PLASTER = {
	Color3.fromHex("E8DFCB"), Color3.fromHex("D9CBAE"), Color3.fromHex("E3D2B5"), Color3.fromHex("CFC3AD"),
	Color3.fromHex("DDB89A"), Color3.fromHex("E9C9A8"), Color3.fromHex("C9BDA6"), Color3.fromHex("D8D2C4"),
	Color3.fromHex("E0C7A0"), Color3.fromHex("BFB5A3"),
}
local ROOFS = {
	{ Color3.fromHex("B65A3C"), Enum.Material.Concrete }, { Color3.fromHex("A9503A"), Enum.Material.Concrete },
	{ Color3.fromHex("8A8F93"), Enum.Material.CorrodedMetal }, { Color3.fromHex("7A7064"), Enum.Material.CorrodedMetal },
	{ Color3.fromHex("6B6F73"), Enum.Material.Concrete },
}
local AWNINGS = {
	Color3.fromHex("B5413A"), Color3.fromHex("2F6F8F"), Color3.fromHex("D9A03F"), Color3.fromHex("4C7F4A"), Color3.fromHex("7A4F8A"),
}
local GLASS = Color3.fromHex("31404A")

-- ---------------------------------------------------------------- stages
function Builder.init(data)
	Data = data
	root = Workspace:FindFirstChild("ThapaeWorld")
	if not root then
		root = Instance.new("Folder")
		root.Name = "ThapaeWorld"
		root.Parent = Workspace
	end
	for _, name in { "Ground", "Roads", "Sidewalks", "Markings", "Water", "Walls", "Trees", "Props", "Buildings" } do
		local f = root:FindFirstChild(name)
		if not f then
			f = Instance.new("Folder")
			f.Name = name
			f.Parent = root
		end
		folders[name] = f
	end
end

function Builder.clear()
	table.clear(occ)
	for _, n in { "ThapaeWorld", "ThapaeGraybox" } do
		local o = Workspace:FindFirstChild(n)
		if o then
			o:Destroy()
		end
	end
	for _, n in { "Baseplate", "SpawnLocation" } do
		local o = Workspace:FindFirstChild(n)
		if o then
			o:Destroy()
		end
	end
end

function Builder.ground()
	local span = Data.half * 2 + 40
	box(folders.Ground, Vector3.new(span, 2, span), CFrame.new(0, -1, 0), Color3.fromHex("B3AEA1"), Enum.Material.Concrete)
	for _, a in Data.areas do
		local poly = toVec2List(a.pts)
		if a.k == "parking" then
			extrude(folders.Ground, poly, 0, 0.12, Color3.fromHex("77777A"), Enum.Material.Asphalt)
		elseif a.k == "pool" then
			extrude(folders.Ground, poly, 0, 0.14, Color3.fromHex("4FA3B8"), Enum.Material.Glass)
		end
	end
end

local ROAD_TOP, SIDEWALK_TOP = 0.10, 0.22

local function roadWidth(r): number
	if r.w then
		return r.w
	end
	local hw = r.hw
	if hw == "secondary" or hw == "tertiary" or hw == "primary" then
		return math.max(r.lanes, 2) * 3.3
	elseif hw == "secondary_link" then
		return 4.5
	elseif hw == "residential" then
		return math.max(r.lanes, 1) * 3.2 + 1
	elseif hw == "service" then
		return 3.6
	elseif hw == "pedestrian" then
		return 5
	elseif hw == "footway" then
		return 2
	elseif hw == "path" then
		return 1.5
	end
	return 4
end

local function roadStyle(r)
	if r.hw == "footway" or r.hw == "path" or r.hw == "pedestrian" then
		return Color3.fromHex("B7AB96"), Enum.Material.Pavement
	end
	if r.s == "paving_stones" then
		return Color3.fromHex("A89C88"), Enum.Material.Pavement
	elseif r.s == "concrete" then
		return Color3.fromHex("A9A8A2"), Enum.Material.Concrete
	end
	return Color3.fromHex("58595C"), Enum.Material.Asphalt
end

local function polyline(parent, pts: { number }, widthM, topY, color, mat, thick)
	local v = toVec2List(pts)
	-- keep open polylines open (toVec2List only drops a closing duplicate)
	for i = 1, #v - 1 do
		local a, b = v[i], v[i + 1]
		local d = b - a
		local len = d.Magnitude
		if len > 0.05 then
			local mid = (a + b) / 2
			local pos = Vector3.new(mid.X, topY - thick / 2, mid.Y)
			local cf = CFrame.lookAt(pos, pos + Vector3.new(d.X, 0, d.Y))
			box(parent, Vector3.new(widthM, thick, len), cf, color, mat)
		end
	end
	for i = 1, #v do
		cylinderUp(parent, widthM, thick, Vector3.new(v[i].X, topY - thick / 2, v[i].Y), color, mat)
	end
	return v
end

function Builder.roads()
	for _, r in Data.roads do
		local color, mat = roadStyle(r)
		local isFoot = r.hw == "footway" or r.hw == "path" or r.hw == "pedestrian"
		polyline(folders.Roads, r.pts, roadWidth(r), isFoot and ROAD_TOP + 0.02 or ROAD_TOP, color, mat, 0.3)
	end
	for _, s in Data.sidewalks do
		local color = Color3.fromHex("C9C1B2")
		local mat = Enum.Material.Pavement
		if s.s == "paving_stones" then
			color, mat = Color3.fromHex("C2B49B"), Enum.Material.Pavement
		elseif s.s == "concrete" then
			color, mat = Color3.fromHex("CFCDC6"), Enum.Material.Concrete
		end
		polyline(folders.Sidewalks, s.pts, 2.0, SIDEWALK_TOP, color, mat, 0.4)
	end
end

local WHITE = Color3.fromHex("ECECE4")

function Builder.markings()
	for _, r in Data.roads do
		local hw = r.hw
		if (hw == "secondary" or hw == "tertiary" or hw == "residential" or hw == "primary") and r.lanes >= 2 then
			local w = roadWidth(r)
			local laneW = w / r.lanes
			local v = toVec2List(r.pts)
			for k = 1, r.lanes - 1 do
				local off = -w / 2 + k * laneW
				for i = 1, #v - 1 do
					local a, b = v[i], v[i + 1]
					local d = b - a
					local len = d.Magnitude
					if len > 4 then
						local dir = d / len
						local nrm = Vector2.new(-dir.Y, dir.X)
						local s = 1.0
						while s + 2.5 < len - 1 do
							local c = a + dir * (s + 1.25) + nrm * off
							local pos = Vector3.new(c.X, ROAD_TOP + 0.025, c.Y)
							box(folders.Markings, Vector3.new(0.12, 0.05, 2.5), CFrame.lookAt(pos, pos + Vector3.new(dir.X, 0, dir.Y)), WHITE, Enum.Material.SmoothPlastic, NOCOLLIDE)
							s += 5.5
						end
					end
				end
			end
		end
	end
	for _, c in Data.crossings do
		if c.marked == 1 then
			local v = toVec2List(c.pts)
			for i = 1, #v - 1 do
				local a, b = v[i], v[i + 1]
				local d = b - a
				local len = d.Magnitude
				if len > 1 then
					local dir = d / len
					local nrm = Vector2.new(-dir.Y, dir.X)
					local s = 0.5
					while s < len - 0.3 do
						local p = a + dir * s
						local pos = Vector3.new(p.X, ROAD_TOP + 0.025, p.Y)
						box(folders.Markings, Vector3.new(0.5, 0.05, 3.0), CFrame.lookAt(pos, pos + Vector3.new(nrm.X, 0, nrm.Y)), WHITE, Enum.Material.SmoothPlastic, NOCOLLIDE)
						s += 1.0
					end
				end
			end
		end
	end
end

function Builder.water()
	for _, w in Data.water do
		local poly = toVec2List(w.pts)
		extrude(folders.Water, poly, 0, 0.16, Color3.fromHex("4D7C70"), Enum.Material.Glass, { Reflectance = 0.12 })
		for i = 1, #poly do
			local a, b = poly[i], poly[i % #poly + 1]
			local d = b - a
			local len = d.Magnitude
			if len > 0.3 then
				local mid = (a + b) / 2
				local pos = Vector3.new(mid.X, 0.55, mid.Y)
				box(folders.Water, Vector3.new(0.45, 1.1, len + 0.3), CFrame.lookAt(pos, pos + Vector3.new(d.X, 0, d.Y)), Color3.fromHex("B3A68F"), Enum.Material.Concrete)
			end
		end
	end
end

local WALL_H = 5.0 -- OSM relation 6115913 (historic=citywalls) height=5; overridden by Data.wallHeight when present

-- Gate spec given by the creator in STUDS (pasted brief, 2026-10-15), converted to METRES here with the project scale:
--   main wall: thickness 6, height 24, length 60 studs; archway: clear 12 wide x 16 high, flattened arch with subtle curved
--   top corners; evenly spaced rectangular merlons (alternating solid/gap); rusty terracotta weathered Brick.
-- The mapped gap between the two wall ends is only ~5.2 m, so the adjoining wall ends are shortened to make room for the gate.
-- Real gate dimensions are NOT sourced (this is the creator's design target, not a survey).
local GATE_LEN = 60 * STUD -- along the wall axis
local GATE_THICK = 6 * STUD -- through the passage
local GATE_H = 24 * STUD -- wall height below the merlons
local OPEN_W = 12 * STUD -- clear width of the archway
local OPEN_H = 16 * STUD -- clear height at the crown
local ARCH_RISE = 4 * STUD -- flattened arch: vertical jambs up to OPEN_H - ARCH_RISE, then a squarish curve
local ARCH_POW = 2.8 -- superellipse exponent (2 = ellipse, larger = squarer top corners)
local MERLON_W, MERLON_H, MERLON_GAP = 3 * STUD, 3 * STUD, 3 * STUD
local RING_W = 1.0 * STUD -- arch ring (voussoir) width, framing the opening
local GATE_DOORS_OPEN = true -- default state of the wooden gates (press E in game to toggle; see GateService)
local BRICK_TONES = { "B5503A", "BA583D", "B14B34", "B8573A", "AD4A33", "B65238" } -- close rust / burnt sienna / terracotta tones
local brickSeed = 0

-- Weathered terracotta: tone varies per piece, dirtier and darker near the ground, slightly bleached near the top.
local function brickTone(y: number): Color3
	brickSeed += 1
	local c = Color3.fromHex(BRICK_TONES[(brickSeed * 7 + math.floor(y * 3)) % #BRICK_TONES + 1])
	c = c:Lerp(Color3.fromHex("5B3A2A"), math.clamp(1 - y / 1.8, 0, 1) * 0.5)
	return c:Lerp(Color3.fromHex("D9A27E"), math.clamp((y - GATE_H * 0.8) / (GATE_H * 0.2), 0, 1) * 0.12)
end

-- Wooden double gates (creator brief, STUDS): fits the 12 x 16 stud arch; planks follow the arch curve at the top
local DOOR_THICK = 1.5 * STUD
local PLANK_W = 1.0 * STUD
local DOOR_TONES = { "6E4C32", "624229", "795636", "5A3F27", "6A4930" } -- dark weathered brown (light enough to read in shade)
local STRAP_H = 1.0 * STUD
local STRAP_AT = { 2.5 * STUD, 6.0 * STUD, 9.5 * STUD } -- strap centre heights (below the arch spring at 12 studs)
local RIVET_D = 0.5 * STUD

function Builder.walls()
	brickSeed = 0 -- same weathering pattern on every rebuild
	local WALL_H = Data.wallHeight or WALL_H -- (unused now: wall height follows the creator's spec GATE_H)
	local axes = {}
	for _, w in Data.walls do
		table.insert(axes, minRect(toVec2List(w.pts)))
	end
	-- the two wall ends that bound the gate gap, and how much each wall must shrink to widen the gap
	local shrink = 0
	local gateWall: { [number]: number } = {} -- axes index -> sign of the end next to the gate (+1 / -1 along the wall axis)
	if #axes >= 2 then
		local bestD = math.huge
		local ia, sa, ib, sb = 1, 1, 2, 1
		for i = 1, 2 do
			for si, sign in { 1, -1 } do
				for j = 1, 2 do
					for sj, sign2 in { 1, -1 } do
						local a = Vector2.new(axes[i].cx + sign * axes[i].ux * axes[i].L / 2, axes[i].cz + sign * axes[i].uz * axes[i].L / 2)
						local b = Vector2.new(axes[j].cx + sign2 * axes[j].ux * axes[j].L / 2, axes[j].cz + sign2 * axes[j].uz * axes[j].L / 2)
						if i ~= j and (a - b).Magnitude < bestD then
							bestD, ia, sa, ib, sb = (a - b).Magnitude, i, sign, j, sign2
						end
					end
				end
			end
		end
		shrink = math.max(0, (GATE_LEN - bestD) / 2)
		gateWall[ia], gateWall[ib] = sa, sb
	end
	for k, mr in axes do
		-- shorten the end that touches the gate (if any); keep the other end where it is
		local L, cx0, cz0 = mr.L, mr.cx, mr.cz
		local sign = gateWall[k]
		if sign then
			L -= shrink
			cx0 -= sign * mr.ux * shrink / 2
			cz0 -= sign * mr.uz * shrink / 2
		end
		-- the adjoining walls follow the gate spec too (thickness 6, height 24 studs) so gate and walls are ONE structure;
		-- brick is split into small pieces of slightly different tone (weathered), merlons 3 / gap 3 studs along the top
		local dir = Vector3.new(mr.ux, 0, mr.uz)
		-- cuts at multiples of the Brick tile (4 studs) so bricks and mortar lines run on across the pieces (see the gate)
		local tile = 4 * STUD
		local s0 = 0
		while s0 < L - 0.001 do
			local s1 = math.min(s0 + 2 * tile, L)
			local mid = Vector3.new(cx0, 0, cz0) + dir * ((s0 + s1) / 2 - L / 2)
			local y0 = 0
			while y0 < GATE_H - 0.001 do
				local y1 = math.min(y0 + tile, GATE_H)
				local pos = Vector3.new(mid.X, (y0 + y1) / 2, mid.Z)
				box(folders.Walls, Vector3.new(GATE_THICK, y1 - y0, s1 - s0), CFrame.lookAt(pos, pos + dir), brickTone((y0 + y1) / 2), Enum.Material.Brick)
				y0 = y1
			end
			s0 = s1
		end
		do
			local period = MERLON_W + MERLON_GAP
			local count = math.max(1, math.floor((L + MERLON_GAP) / period))
			local span = count * MERLON_W + (count - 1) * MERLON_GAP
			for m = 0, count - 1 do
				local a = -span / 2 + MERLON_W / 2 + m * period
				local c = Vector3.new(cx0, GATE_H + MERLON_H / 2, cz0) + dir * a
				box(folders.Walls, Vector3.new(GATE_THICK, MERLON_H, MERLON_W), CFrame.lookAt(c, c + dir), brickTone(GATE_H), Enum.Material.Brick)
			end
		end
	end
	-- Gate (estimated from public descriptions: crenellated red-brick gate with a wide arched opening and a pair of
	-- heavy wooden doors; rebuilt 1985-86 on the old site). Real dimensions are NOT sourced; values below are guesses.
	-- Placement is derived from the mapped wall polygons: the gate fills the gap between the two nearest wall ends.
	if #axes >= 2 then
		local function ends(mr)
			return {
				Vector2.new(mr.cx + mr.ux * mr.L / 2, mr.cz + mr.uz * mr.L / 2),
				Vector2.new(mr.cx - mr.ux * mr.L / 2, mr.cz - mr.uz * mr.L / 2),
			}
		end
		local bestD, e1, e2 = math.huge, nil, nil
		for _, a in ends(axes[1]) do
			for _, b in ends(axes[2]) do
				if (a - b).Magnitude < bestD then
					bestD, e1, e2 = (a - b).Magnitude, a, b
				end
			end
		end
		local mid = (e1 + e2) / 2
		local gl = bestD + 2 * shrink -- gap length along the wall axis AFTER the wall ends were shortened
		local ux, uz = axes[1].ux, axes[1].uz
		if (e2 - e1):Dot(Vector2.new(ux, uz)) < 0 then
			ux, uz = -ux, -uz
		end
		local depth = (axes[1].W + axes[2].W) / 2
		local u = Vector3.new(ux, 0, uz)
		local nrm = Vector3.new(-uz, 0, ux)
		local center = Vector3.new(mid.X, 0, mid.Y)
		local function at(a: number, y: number): Vector3
			return center + u * a + Vector3.new(0, y, 0)
		end
		local hg = gl / 2
		local ow = OPEN_W / 2
		local yS = OPEN_H - ARCH_RISE -- height where the arch starts to curve
		local rot = (CFrame.lookAt(center, center + u) * CFrame.Angles(0, math.rad(90), 0)).Rotation
		-- The Brick texture repeats every 4 studs (one course = 1 stud) and RESTARTS at each part's corner, so thin or oddly cut
		-- pieces show up as stripes. Every cut here is therefore a multiple of that tile (pieces are 2 x 2 tiles, the last one
		-- shorter), which keeps bricks and mortar lines running on across the pieces. Tone still varies per piece (weathering).
		local TILE = 4 * STUD
		local function slab(a0: number, a1: number, y0: number, y1: number)
			if a1 - a0 <= 0.02 or y1 - y0 <= 0.02 then
				return
			end
			local x = a0
			while x < a1 - 0.001 do
				local xe = math.min(x + 2 * TILE, a1)
				local y = y0
				while y < y1 - 0.001 do
					local ye = math.min(y + 2 * TILE, y1)
					box(folders.Walls, Vector3.new(xe - x, ye - y, GATE_THICK), CFrame.new(at((x + xe) / 2, (y + ye) / 2)) * rot, brickTone((y + ye) / 2), Enum.Material.Brick)
					y = ye
				end
				x = xe
			end
		end
		-- big continuous blocks: either side of the opening + ring, and above the crown (it starts at 16 studs = exactly 4 tiles)
		local hx = ow + RING_W
		slab(-hg, -hx, 0, GATE_H)
		slab(hx, hg, 0, GATE_H)
		slab(-hx, hx, OPEN_H, GATE_H)
		-- arch ring: stones laid along the opening curve, slightly proud of both wall faces, two alternating tones
		do
			local stones = 26
			local function curve(theta: number): (number, number)
				local c, s = math.cos(theta), math.sin(theta)
				local px = ow * (c >= 0 and 1 or -1) * math.abs(c) ^ (2 / ARCH_POW)
				local py = yS + ARCH_RISE * math.abs(s) ^ (2 / ARCH_POW)
				return px, py
			end
			-- below the arch spring the ring continues straight down the jambs as quoin stones
			local jambStones = math.floor(yS / (RING_W * 1.5))
			local ringTones = { "C06A47", "AA4A33" }
			local function stone(cx: number, cy: number, len: number, angle: number, k: number)
				local pos = at(cx, cy)
				box(folders.Walls, Vector3.new(len, RING_W, GATE_THICK + 0.04), CFrame.new(pos) * rot * CFrame.Angles(0, 0, angle), Color3.fromHex(ringTones[k % 2 + 1]), Enum.Material.Brick)
			end
			for k = 0, stones - 1 do
				local t0, t1 = math.pi * k / stones, math.pi * (k + 1) / stones
				local x0, y0 = curve(t0)
				local x1, y1 = curve(t1)
				local dx, dy = x1 - x0, y1 - y0
				local len = math.sqrt(dx * dx + dy * dy)
				local mx, my = (x0 + x1) / 2, (y0 + y1) / 2
				-- outward normal of the curve (away from the opening centre)
				local nx, ny = dy / len, -dx / len
				if nx * mx + ny * (my - yS) < 0 then
					nx, ny = -nx, -ny
				end
				stone(mx + nx * RING_W / 2, my + ny * RING_W / 2, len * 1.04, math.atan2(dy, dx), k)
			end
			for side = -1, 1, 2 do
				for j = 0, jambStones - 1 do
					local hh = yS / jambStones
					local cy = hh * (j + 0.5)
					local pos = at(side * (ow + RING_W / 2), cy)
					box(folders.Walls, Vector3.new(RING_W, hh * 0.98, GATE_THICK + 0.04), CFrame.new(pos) * rot, Color3.fromHex(ringTones[j % 2 + 1]), Enum.Material.Brick)
				end
			end
			-- corner fill: the area between the outer edge of the ring and the rectangle corner (hx, OPEN_H) is filled with a
			-- fan of triangular prisms, so the opening keeps a crisp curved edge with no stair steps
			local outer: { { number } } = {}
			local N = 16
			for i = 0, N do
				local px, py = curve((math.pi / 2) * i / N)
				local gx = (px / ow) ^ (ARCH_POW - 1) / ow
				local gy = ((py - yS) / ARCH_RISE) ^ (ARCH_POW - 1) / ARCH_RISE
				local gn = math.sqrt(gx * gx + gy * gy)
				table.insert(outer, { px + gx / gn * RING_W, py + gy / gn * RING_W })
			end
			local use: { { number } } = {}
			for i = 1, #outer do
				if outer[i][2] <= OPEN_H then
					table.insert(use, outer[i])
				else
					local p0 = outer[i - 1]
					if p0 then
						local t = (OPEN_H - p0[2]) / (outer[i][2] - p0[2])
						table.insert(use, { p0[1] + t * (outer[i][1] - p0[1]), OPEN_H })
					end
					break
				end
			end
			for side = -1, 1, 2 do
				local corner = at(side * hx, OPEN_H)
				for i = 1, #use - 1 do
					triPrism(folders.Walls, at(side * use[i][1], use[i][2]), at(side * use[i + 1][1], use[i + 1][2]), corner, GATE_THICK, brickTone(use[i][2]), Enum.Material.Brick)
				end
			end
		end
		-- merlons: evenly spaced solid blocks with open gaps, centred on the gate
		local period = MERLON_W + MERLON_GAP
		local count = math.max(1, math.floor((gl + MERLON_GAP) / period))
		local span = count * MERLON_W + (count - 1) * MERLON_GAP
		for k = 0, count - 1 do
			local a = -span / 2 + MERLON_W / 2 + k * period
			box(folders.Walls, Vector3.new(MERLON_W, MERLON_H, GATE_THICK), CFrame.new(at(a, GATE_H + MERLON_H / 2)) * rot, brickTone(GATE_H), Enum.Material.Brick)
		end
		-- ---------------------------------------------------------------- wooden double gates (E toggles, default OPEN)
		-- Two identical leaves. Each leaf is a Model: a row of vertical planks whose tops follow the arch (so the pair fits the
		-- 12 x 16 stud opening exactly), black iron straps, and half-sphere rivets on both faces. The leaves hang flush with the
		-- plaza-side face and swing 90 degrees OUTWARD about the jamb, so an open gate leaves the full 12 studs clear.
		-- Each leaf has a hidden Hinge part (PrimaryPart) and CFrame attributes ClosedCFrame / OpenCFrame; ServerScriptService
		-- GateService tweens the hinge. This builder leaves the leaves in the default state (GATE_DOORS_OPEN).
		local plazaDir = nrm * (nrm.X > 0 and 1 or -1) -- towards the plaza (east); the town is the other way
		local planeOff = plazaDir * (GATE_THICK / 2 - DOOR_THICK / 2 - 0.03)
		local doors = Instance.new("Folder")
		doors.Name = "GateDoors"
		doors:SetAttribute("Open", GATE_DOORS_OPEN)
		doors.Parent = folders.Walls
		local function archTop(x: number): number
			local r = math.min(math.abs(x) / ow, 1)
			return yS + ARCH_RISE * (1 - r ^ ARCH_POW) ^ (1 / ARCH_POW)
		end
		local planksPerLeaf = math.max(1, math.floor(ow / PLANK_W + 0.5))
		local plankW = ow / planksPerLeaf
		for _, sigma in { -1, 1 } do
			local leaf = Instance.new("Model")
			leaf.Name = sigma < 0 and "LeafL" or "LeafR"
			leaf.Parent = doors
			-- hidden hinge on the jamb edge of the leaf (vertical axis)
			local hingeM = at(sigma * ow, 0.05) + planeOff
			local hinge = box(leaf, Vector3.new(0.05, 0.05, 0.05), CFrame.new(hingeM) * rot, Color3.fromHex("18181B"), Enum.Material.Metal, { Name = "Hinge", Transparency = 1, CanCollide = false, CanTouch = false, CanQuery = false, CastShadow = false })
			leaf.PrimaryPart = hinge
			for k = 0, planksPerLeaf - 1 do
				local x0, x1 = sigma * (k * plankW + 0.01), sigma * ((k + 1) * plankW - 0.01)
				local xc = (x0 + x1) / 2
				local top = archTop(math.max(math.abs(x0), math.abs(x1))) - 0.04
				local h = top - 0.03
				box(leaf, Vector3.new(plankW - 0.02, h, DOOR_THICK), CFrame.new(at(xc, 0.03 + h / 2) + planeOff) * rot, Color3.fromHex(DOOR_TONES[(k * 3 + (sigma > 0 and 2 or 0)) % #DOOR_TONES + 1]), Enum.Material.WoodPlanks)
			end
			local leafW = ow - 0.04
			local leafC = sigma * (ow / 2)
			for _, yH in STRAP_AT do
				-- one band through the leaf, a little thicker than the planks so it shows on both faces
				box(leaf, Vector3.new(leafW, STRAP_H, DOOR_THICK + 0.1), CFrame.new(at(leafC, yH) + planeOff) * rot, Color3.fromHex("18181B"), Enum.Material.Metal)
				-- rivets: half spheres (centre on the strap face, half buried), one per stud along the strap, both faces
				local nR = math.max(1, math.floor(leafW / (1.0 * STUD)))
				for r = 0, nR - 1 do
					local rx = sigma * ((r + 0.5) * (ow / nR))
					for _, face in { -1, 1 } do
						ball(leaf, RIVET_D, at(rx, yH) + planeOff + nrm * face * (DOOR_THICK / 2 + 0.05), Color3.fromHex("34343A"), Enum.Material.Metal, NOCOLLIDE)
					end
				end
			end
			-- open pose: rotate 90 degrees about the hinge so the leaf (closed: hinge -> middle of the opening) points to the plaza
			local vClosed = -sigma * u
			local theta = math.rad(90)
			if CFrame.Angles(0, theta, 0):VectorToWorldSpace(vClosed):Dot(plazaDir) < 0.9 then
				theta = -theta
			end
			local closedCF = hinge.CFrame
			local openCF = CFrame.new(closedCF.Position) * CFrame.Angles(0, theta, 0) * closedCF.Rotation
			leaf:SetAttribute("ClosedCFrame", closedCF)
			leaf:SetAttribute("OpenCFrame", openCF)
			if GATE_DOORS_OPEN then
				leaf:PivotTo(openCF)
			end
		end
		-- the prompt (press E): hidden anchor in the middle of the passage
		do
			local anchor = box(doors, Vector3.new(0.2, 0.2, 0.2), CFrame.new(at(0, 1.4)) * rot, Color3.fromHex("18181B"), Enum.Material.SmoothPlastic, { Name = "PromptAnchor", Transparency = 1, CanCollide = false, CanTouch = false, CanQuery = false, CastShadow = false })
			local prompt = Instance.new("ProximityPrompt")
			prompt.Name = "GatePrompt"
			prompt.ObjectText = "ประตูท่าแพ"
			prompt.ActionText = GATE_DOORS_OPEN and "ปิดประตู" or "เปิดประตู"
			prompt.KeyboardKeyCode = Enum.KeyCode.E
			prompt.GamepadKeyCode = Enum.KeyCode.ButtonX
			prompt.HoldDuration = 0
			prompt.MaxActivationDistance = 14 -- studs
			prompt.RequiresLineOfSight = false
			prompt.Parent = anchor
		end
		root:SetAttribute("gateCenterM", string.format("%.2f, %.2f", mid.X, mid.Y))
		root:SetAttribute("gateGapM", string.format("%.2f", gl))
		root:SetAttribute("gateSpecStuds", "wall 60 x 24 x 6, opening 12 x 16, merlons 3/3/3 (creator brief 2026-10-15)")
		-- gate frame for the moat stage: u = along the wall, gateNrm = through the passage towards the plaza
		root:SetAttribute("gateU", u)
		root:SetAttribute("gateNrm", plazaDir)
	end
end

-- ================================================================ moat + entrance bridge (creator brief, STUDS)
-- A straight moat parallel to the front (plaza side) of the gate wall, 16 studs wide and 6 deep, lined with mossy Slate,
-- filled with Roblox Terrain water; a 12 x 16 stud concrete bridge on the gate axis, deck top level with the ground
-- (= 1 stud above the water), low grey concrete rails. This is a POST-PASS: run it after ground/places/props/walls.
-- It cuts the strip out of the ground (the 250 m base slab and the thin plaza triangles are re-cut with exact geometry),
-- moves props that stand in the strip to the far bank, then builds lining, water and bridge into ThapaeWorld.Moat.
local MOAT_W = 16 * STUD
local MOAT_DEPTH = 6 * STUD
local MOAT_LINING = 1 * STUD
local MOAT_HALF_LEN = 35 -- metres each side of the gate, along the wall
local WATER_BELOW_RIM = 1 * STUD
local BRIDGE_W = 12 * STUD
local BRIDGE_T = 0.5 * STUD
local RAIL_H = 3 * STUD
local RAIL_T = 1 * STUD
local LEAF_CLEAR = 7 * STUD -- rails start this far from the wall: the open gate leaves swing over that stretch

function Builder.moat(): { [string]: any }
	local stats = { carvedTriangles = 0, removedParts = 0, clippedBoxes = 0, shiftedProps = 0, moatParts = 0 }
	local gc = tostring(root:GetAttribute("gateCenterM") or "")
	local gx, gz = gc:match("([%-%d%.]+), ([%-%d%.]+)")
	local uVec, nVec = root:GetAttribute("gateU"), root:GetAttribute("gateNrm")
	if not (gx and uVec and nVec) then
		error("moat(): run Builder.walls() first (gate attributes missing)")
	end
	local anchor = Vector2.new(tonumber(gx), tonumber(gz))
	local u2, p2 = Vector2.new(uVec.X, uVec.Z), Vector2.new(nVec.X, nVec.Z) -- along the wall / towards the plaza (unit)
	local S0 = GATE_THICK / 2 -- wall front face
	local S1 = S0 + MOAT_W
	local AH = MOAT_HALF_LEN
	local function toSA(x: number, z: number): Vector2
		local d = Vector2.new(x, z) - anchor
		return Vector2.new(d:Dot(p2), d:Dot(u2))
	end
	local function toXZ(s: number, a: number): Vector2
		return anchor + p2 * s + u2 * a
	end
	local function fbox(parent, sC: number, aC: number, y0: number, y1: number, sSize: number, aSize: number, color, mat, opts)
		local p = toXZ(sC, aC)
		local cf = CFrame.fromMatrix(Vector3.new(p.X, (y0 + y1) / 2, p.Y), Vector3.new(u2.X, 0, u2.Y), Vector3.yAxis, Vector3.new(p2.X, 0, p2.Y))
		return box(parent, Vector3.new(aSize, y1 - y0, sSize), cf, color, mat, opts)
	end

	local moatFolder = root:FindFirstChild("Moat")
	if moatFolder then
		moatFolder:Destroy()
	end
	moatFolder = Instance.new("Folder")
	moatFolder.Name = "Moat"
	moatFolder.Parent = root

	-- ---------------------------------------------------------------- 1. cut the strip out of the ground
	local function clipPoly(poly: { Vector2 }, nx: number, nz: number, d: number): { Vector2 }
		local out = {}
		for i = 1, #poly do
			local a, b = poly[i], poly[i % #poly + 1]
			local da, db = nx * a.X + nz * a.Y - d, nx * b.X + nz * b.Y - d
			if da <= 0 then
				table.insert(out, a)
			end
			if (da < 0 and db > 0) or (da > 0 and db < 0) then
				table.insert(out, a + (b - a) * (da / (da - db)))
			end
		end
		return out
	end
	-- pieces of a triangle (in s,a) that lie OUTSIDE the strip s in [S0,S1], |a| <= AH; convex polygons
	local function outside(tri: { Vector2 }): ({ { Vector2 } }, number)
		local pieces = {}
		local area = 0
		local function add(p: { Vector2 })
			if #p >= 3 and math.abs(polyArea(p)) > 1e-4 then
				table.insert(pieces, p)
				area += math.abs(polyArea(p))
			end
		end
		add(clipPoly(tri, 1, 0, S0))
		add(clipPoly(tri, -1, 0, -S1))
		local mid = clipPoly(clipPoly(tri, -1, 0, -S0), 1, 0, S1)
		add(clipPoly(mid, 0, 1, -AH))
		add(clipPoly(mid, 0, -1, -AH))
		return pieces, area
	end
	local function emitPieces(parent: Instance, pieces: { { Vector2 } }, yC: number, thick: number, color, mat, opts)
		for _, poly in pieces do
			local v = {}
			for _, q in poly do
				local p = toXZ(q.X, q.Y)
				table.insert(v, Vector3.new(p.X, yC, p.Y))
			end
			for k = 2, #v - 1 do
				triPrism(parent, v[1], v[k], v[k + 1], thick, color, mat, opts)
			end
		end
	end
	local function carveTriangle(parent: Instance, tri3: { Vector3 }, yC: number, thick: number, color, mat, opts): boolean
		local tri = {}
		for _, p in tri3 do
			table.insert(tri, toSA(p.X, p.Z))
		end
		local ar = math.abs(polyArea(tri))
		if ar < 1e-6 then
			return false
		end
		local lo, hi = math.huge, -math.huge
		local alo, ahi = math.huge, -math.huge
		for _, q in tri do
			lo, hi, alo, ahi = math.min(lo, q.X), math.max(hi, q.X), math.min(alo, q.Y), math.max(ahi, q.Y)
		end
		if hi < S0 or lo > S1 or ahi < -AH or alo > AH then
			return false -- does not touch the strip
		end
		local pieces, outArea = outside(tri)
		if ar - outArea < 1e-3 then
			return false -- strip does not actually cut it
		end
		emitPieces(parent, pieces, yC, thick, color, mat, opts)
		return true
	end

	for _, fname in { "Ground", "Roads", "Sidewalks", "Markings" } do
		local f = folders[fname] or root:FindFirstChild(fname)
		if f then
			for _, p in f:GetDescendants() do
				if p:IsA("WedgePart") and math.abs(p.CFrame.RightVector.Y) > 0.99 then
					-- a horizontal triangle (half of a triPrism): right angle at local (-h/2.. see probe) -> vertices
					local h, l = p.Size.Y, p.Size.Z
					local cf = p.CFrame
					local tri3 = {}
					for _, lv in { Vector3.new(0, -h / 2, -l / 2), Vector3.new(0, -h / 2, l / 2), Vector3.new(0, h / 2, l / 2) } do
						local w = cf:PointToWorldSpace(lv)
						table.insert(tri3, Vector3.new(w.X * STUD, 0, w.Z * STUD))
					end
					local opts = { CanCollide = p.CanCollide, CanTouch = p.CanTouch, CanQuery = p.CanQuery, CastShadow = p.CastShadow }
					if carveTriangle(p.Parent, tri3, p.Position.Y * STUD, p.Size.X * STUD, p.Color, p.Material, opts) then
						stats.carvedTriangles += 1
						p:Destroy()
					end
				elseif p:IsA("BasePart") and not p:IsA("WedgePart") and not (p:IsA("Part") and p.Shape == Enum.PartType.Block) then
					-- cylinders, balls, meshes (e.g. manhole covers): removed when their centre lies inside the strip
					local q = toSA(p.Position.X * STUD, p.Position.Z * STUD)
					if q.X > S0 - 0.2 and q.X < S1 + 0.2 and math.abs(q.Y) < AH then
						p:Destroy()
						stats.removedParts += 1
					end
				elseif p:IsA("Part") and p.Shape == Enum.PartType.Block then
					local sz = p.Size * STUD
					if sz.X > 100 and sz.Z > 100 then
						-- the base slab: re-cut as two triangles of its own footprint
						local cx, cz = p.Position.X * STUD, p.Position.Z * STUD
						local hx, hz = sz.X / 2, sz.Z / 2
						local c = { Vector3.new(cx - hx, 0, cz - hz), Vector3.new(cx + hx, 0, cz - hz), Vector3.new(cx + hx, 0, cz + hz), Vector3.new(cx - hx, 0, cz + hz) }
						local opts = { CanCollide = p.CanCollide, CanTouch = p.CanTouch, CanQuery = p.CanQuery, CastShadow = p.CastShadow }
						local a1 = carveTriangle(p.Parent, { c[1], c[2], c[3] }, p.Position.Y * STUD, sz.Y, p.Color, p.Material, opts)
						local a2 = carveTriangle(p.Parent, { c[1], c[3], c[4] }, p.Position.Y * STUD, sz.Y, p.Color, p.Material, opts)
						if a1 or a2 then
							-- a triangle the strip does not touch must still exist: re-emit it whole
							if not a1 then
								emitPieces(p.Parent, { { Vector2.new(toSA(c[1].X, c[1].Z).X, toSA(c[1].X, c[1].Z).Y), toSA(c[2].X, c[2].Z), toSA(c[3].X, c[3].Z) } }, p.Position.Y * STUD, sz.Y, p.Color, p.Material, opts)
							end
							if not a2 then
								emitPieces(p.Parent, { { toSA(c[1].X, c[1].Z), toSA(c[3].X, c[3].Z), toSA(c[4].X, c[4].Z) } }, p.Position.Y * STUD, sz.Y, p.Color, p.Material, opts)
							end
							stats.carvedTriangles += 2
							p:Destroy()
						end
					else
						-- other boxes (plaza joint lines, the 2 m path under the gate, small road bits): clip along the long axis
						local long = sz.X >= sz.Z and "X" or "Z"
						local len = math.max(sz.X, sz.Z)
						local wid = math.min(sz.X, sz.Z)
						-- world direction of the part's LOCAL +X / +Z axis (LookVector is -Z, so it must be negated)
						local axisV = (long == "X") and p.CFrame.RightVector or -p.CFrame.LookVector
						local c = toSA(p.Position.X * STUD, p.Position.Z * STUD)
						local dirSA = Vector2.new(axisV.X, axisV.Z)
						dirSA = Vector2.new(dirSA:Dot(p2), dirSA:Dot(u2))
						-- interval of the segment c + t*dirSA, t in [-len/2, len/2], inside the strip (slab method)
						local tmin, tmax = -len / 2, len / 2
						local function slab1(cc: number, dd: number, lo: number, hi: number)
							if math.abs(dd) < 1e-9 then
								if cc < lo or cc > hi then
									tmin, tmax = 1, 0
								end
							else
								local t1, t2 = (lo - cc) / dd, (hi - cc) / dd
								if t1 > t2 then
									t1, t2 = t2, t1
								end
								tmin, tmax = math.max(tmin, t1), math.min(tmax, t2)
							end
						end
						slab1(c.X, dirSA.X, S0 - wid / 2, S1 + wid / 2)
						slab1(c.Y, dirSA.Y, -AH - wid / 2, AH + wid / 2)
						if tmin < tmax and p.Size.Y * STUD < 1.5 then
							-- inside part = [tmin, tmax]; keep the outside remainders
							local keepA = { -len / 2, tmin }
							local keepB = { tmax, len / 2 }
							local pieces = {}
							for _, k in { keepA, keepB } do
								if k[2] - k[1] > 0.05 then
									table.insert(pieces, k)
								end
							end
							if #pieces == 0 then
								p:Destroy()
								stats.removedParts += 1
							else
								local origCF = p.CFrame
								local axisLocal = (long == "X") and Vector3.xAxis or Vector3.zAxis
								for i, k in pieces do
									local target = p
									if i > 1 then
										target = p:Clone()
										target.Parent = p.Parent
									end
									local mid = (k[1] + k[2]) / 2
									local newSize = p.Size
									newSize = (long == "X") and Vector3.new((k[2] - k[1]) / STUD, newSize.Y, newSize.Z) or Vector3.new(newSize.X, newSize.Y, (k[2] - k[1]) / STUD)
									target.Size = newSize
									target.CFrame = origCF * CFrame.new(axisLocal * (mid / STUD))
								end
								stats.clippedBoxes += 1
							end
						end
					end
				end
			end
		end
	end

	-- props / street decor standing in the strip move to the far bank (they keep their a-position)
	local shift = (S1 - S0) + 0.8
	for _, fname in { "Props", "StreetDecor" } do
		local f = folders[fname] or root:FindFirstChild(fname)
		if f then
			for _, p in f:GetDescendants() do
				if p:IsA("BasePart") then
					local q = toSA(p.Position.X * STUD, p.Position.Z * STUD)
					if q.X > S0 - 0.4 and q.X < S1 + 0.3 and math.abs(q.Y) < AH + 1 then
						local d = p2 * shift / STUD
						p.CFrame = p.CFrame + Vector3.new(d.X, 0, d.Y)
						stats.shiftedProps += 1
					end
				end
			end
		end
	end

	-- ---------------------------------------------------------------- 2. lining (mossy slate), floor, coping
	local function moss(y: number, id: number): Color3
		-- y = height in metres (0 = rim, negative = down); greener and darker nearer the water and the bottom
		local t = math.clamp(-y / 1.2, 0, 1)
		local stone = Color3.fromRGB(122, 126, 118):Lerp(Color3.fromRGB(102, 108, 100), rnd(id, 3))
		local green = Color3.fromRGB(62, 96, 64):Lerp(Color3.fromRGB(48, 78, 56), rnd(id, 5))
		return stone:Lerp(green, t * 0.85 * (0.7 + 0.3 * rnd(id, 7)))
	end
	local id = 0
	local TILE = 4 * STUD
	local function lining(sC: number, aC: number, y0: number, y1: number, sSize: number, aSize: number)
		-- split along the long horizontal direction into tile-length pieces and vertically into 2 bands
		local alongA = aSize >= sSize
		local n = math.max(1, math.ceil((alongA and aSize or sSize) / (2 * TILE)))
		local bands = math.max(1, math.ceil((y1 - y0) / TILE))
		for i = 0, n - 1 do
			for j = 0, bands - 1 do
				id += 1
				local yy0, yy1 = y0 + (y1 - y0) * j / bands, y0 + (y1 - y0) * (j + 1) / bands
				local sc, ac, ss, as = sC, aC, sSize, aSize
				if alongA then
					as = aSize / n
					ac = aC - aSize / 2 + as * (i + 0.5)
				else
					ss = sSize / n
					sc = sC - sSize / 2 + ss * (i + 0.5)
				end
				fbox(moatFolder, sc, ac, yy0, yy1, ss, as, moss((yy0 + yy1) / 2, id), Enum.Material.Slate)
				stats.moatParts += 1
			end
		end
	end
	local floorTop = -MOAT_DEPTH
	-- floor (below the water) and the four walls; the near wall stands against the fortress wall
	lining((S0 + S1) / 2, 0, floorTop - 0.28, floorTop, S1 - S0, 2 * AH)
	lining(S0 + MOAT_LINING / 2, 0, floorTop, 0, MOAT_LINING, 2 * AH)
	lining(S1 - MOAT_LINING / 2, 0, floorTop, 0, MOAT_LINING, 2 * AH)
	for _, sgn in { -1, 1 } do
		lining((S0 + S1) / 2, sgn * (AH - MOAT_LINING / 2), floorTop, 0, S1 - S0, MOAT_LINING)
	end
	-- coping: a stone lip over the cut edge of the plaza paving (the paving is 0.13 m thick); not across the bridge
	local copeTop = 0.16
	local function cope(sC: number, aC: number, sSize: number, aSize: number)
		id += 1
		fbox(moatFolder, sC, aC, 0, copeTop, sSize, aSize, Color3.fromRGB(128, 130, 122):Lerp(Color3.fromRGB(104, 112, 100), rnd(id, 11)), Enum.Material.Slate)
		stats.moatParts += 1
	end
	local bw = BRIDGE_W / 2
	for _, sgn in { -1, 1 } do
		-- along the far edge, on both sides of the bridge opening, and around the two ends
		local a0, a1 = bw, AH + 0.22
		cope(S1 - MOAT_LINING / 2 + 0.11, sgn * (a0 + a1) / 2, MOAT_LINING + 0.22, a1 - a0)
		cope((S0 + S1) / 2 + 0.11, sgn * (AH - MOAT_LINING / 2 + 0.11), S1 - S0 + 0.22, MOAT_LINING + 0.22)
	end

	-- ---------------------------------------------------------------- 3. water (Roblox Terrain water)
	local terrain = Workspace.Terrain
	local waterTop = -WATER_BELOW_RIM
	-- Terrain voxels are 4 studs, so the water at the edge of a fill block is lower than in the middle. The block therefore
	-- covers the WHOLE trench (it overlaps the lining parts, which hide it), so the surface is level where it meets the wall.
	local pc = toXZ((S0 + S1) / 2, 0)
	local yMid = (floorTop + waterTop) / 2
	local sizeStuds = Vector3.new(2 * AH / STUD, (waterTop - floorTop) / STUD, (S1 - S0) / STUD)
	local wcf = CFrame.fromMatrix(Vector3.new(pc.X / STUD, yMid / STUD, pc.Y / STUD), Vector3.new(u2.X, 0, u2.Y), Vector3.yAxis, Vector3.new(p2.X, 0, p2.Y))
	terrain:FillBlock(wcf, sizeStuds, Enum.Material.Water)
	pcall(function()
		terrain.WaterColor = Color3.fromRGB(46, 112, 104) -- natural green-blue
		terrain.WaterTransparency = 0.4 -- low transparency (default is almost clear)
		terrain.WaterReflectance = 0.25
		terrain.WaterWaveSize = 0.05
		terrain.WaterWaveSpeed = 6
	end)

	-- ---------------------------------------------------------------- 4. bridge on the gate axis
	local concrete = Color3.fromRGB(184, 184, 186)
	fbox(moatFolder, (S0 + S1) / 2, 0, -BRIDGE_T, 0.005, S1 - S0, BRIDGE_W, concrete, Enum.Material.Concrete, { Name = "BridgeDeck" })
	local railS0 = S0 + LEAF_CLEAR
	local railC = (railS0 + S1) / 2
	for _, sgn in { -1, 1 } do
		fbox(moatFolder, railC, sgn * (bw - RAIL_T / 2), 0, RAIL_H, S1 - railS0, RAIL_T, Color3.fromRGB(168, 168, 170), Enum.Material.Concrete, { Name = "BridgeRail" })
		-- slightly bigger post at the far end of each rail
		fbox(moatFolder, S1 - RAIL_T * 0.6, sgn * (bw - RAIL_T * 0.6), 0, RAIL_H + 0.1, RAIL_T * 1.2, RAIL_T * 1.2, Color3.fromRGB(158, 158, 160), Enum.Material.Concrete, { Name = "BridgePost" })
		stats.moatParts += 2
	end
	stats.moatParts += 1
	root:SetAttribute("moatSpecStuds", "moat 16 wide x 6 deep, bridge 12 x 16, water 1 stud below the rim (creator brief 2026-10-15)")
	return stats
end

-- Free Creator Store prefabs (vetted; see roblox/assets/third-party-assets.md). Every use is optional:
-- when ServerStorage.EchoAtlas.Prefabs lacks a prefab the builder falls back to its own procedural geometry.
local function prefab(name: string)
	local r = game:GetService("ServerStorage"):FindFirstChild("EchoAtlas")
	local f = r and r:FindFirstChild("Prefabs")
	return f and f:FindFirstChild(name)
end

local function spawnPrefab(name: string, xM: number, zM: number, yaw: number, scale: number?, parent: Instance, yM: number?)
	local src = prefab(name)
	if not src then
		return nil
	end
	local m = src:Clone()
	if scale and scale ~= 1 then
		m:ScaleTo(m:GetScale() * scale)
	end
	m:PivotTo(CFrame.new(xM / STUD, (yM or 0) / STUD, zM / STUD) * CFrame.Angles(0, yaw, 0))
	m.Parent = parent
	tick()
	return m
end

function Builder.trees()
	releaseTag("tree")
	local skipped = 0
	for i, t in Data.trees do
		-- OSM tree nodes can sit on a kerb or in a mapped gap; skip any that fall in a road/building or onto another tree
		if not placeOk(t[1], t[2], 0.8, "tree", { roadMargin = -1.2 }) then
			skipped += 1
			continue
		end
		if i % 3 == 0 and prefab("TreeRain") then
			spawnPrefab("TreeRain", t[1], t[2], rnd(i, 30) * math.pi * 2, 0.85 + rnd(i, 31) * 0.4, folders.Trees)
			continue
		end
		if prefab("StreetTreeA") and prefab("StreetTreeB") then
			local name = rnd(i, 32) < 0.5 and "StreetTreeA" or "StreetTreeB"
			spawnPrefab(name, t[1], t[2], rnd(i, 33) * math.pi * 2, 0.85 + rnd(i, 34) * 0.3, folders.Trees)
			continue
		end
		local model = Instance.new("Model")
		model.Name = "Tree" .. i
		local x, z = t[1], t[2]
		local trunkH = 3.2 + rnd(i, 1) * 1.6
		local canopy = 5.0 + rnd(i, 2) * 3.0
		cylinderUp(model, 0.45, trunkH, Vector3.new(x, trunkH / 2, z), Color3.fromHex("6A5238"), Enum.Material.Wood)
		local greens = { Color3.fromHex("4F7A45"), Color3.fromHex("5E8C4A"), Color3.fromHex("3F6B3C"), Color3.fromHex("6C9650") }
		for k = 1, 3 do
			local ox, oz = (rnd(i, 3 + k) - 0.5) * canopy * 0.35, (rnd(i, 7 + k) - 0.5) * canopy * 0.35
			local d = canopy * (0.72 + 0.14 * k / 3)
			ball(model, d, Vector3.new(x + ox, trunkH + canopy * 0.32 + k * 0.25, z + oz), pick(greens, i, 20 + k), Enum.Material.Grass, NOCOLLIDE)
		end
		model.Parent = folders.Trees
	end
	return skipped
end

function Builder.props()
	for i, p in Data.props do
		if p.k == "post_box" then
			claim(p.x, p.z, 0.4, "prop")
			box(folders.Props, Vector3.new(0.5, 1.1, 0.5), CFrame.new(p.x, 0.55 + SIDEWALK_TOP, p.z), Color3.fromHex("C0392B"), Enum.Material.Metal)
		elseif p.k == "fountain" then
			claim(p.x, p.z, 1.8, "prop")
			cylinderUp(folders.Props, 3.2, 0.6, Vector3.new(p.x, 0.3, p.z), Color3.fromHex("B3A68F"), Enum.Material.Concrete)
			cylinderUp(folders.Props, 2.6, 0.62, Vector3.new(p.x, 0.31, p.z), Color3.fromHex("4D7C70"), Enum.Material.Glass, NOCOLLIDE)
			cylinderUp(folders.Props, 0.5, 1.6, Vector3.new(p.x, 0.8, p.z), Color3.fromHex("B3A68F"), Enum.Material.Concrete)
		end
	end

end

-- Buildings -----------------------------------------------------------------
local roadSegs
local function ensureRoadSegs()
	if roadSegs then
		return
	end
	roadSegs = {}
	for _, r in Data.roads do
		if r.hw ~= "footway" and r.hw ~= "path" then
			local v = toVec2List(r.pts)
			for i = 1, #v - 1 do
				table.insert(roadSegs, { v[i].X, v[i].Y, v[i + 1].X, v[i + 1].Y, roadWidth(r) / 2, r.id })
			end
		end
	end
end

local function roadDist(x, z): number
	local best = math.huge
	for _, s in roadSegs do
		best = math.min(best, segDist(x, z, s[1], s[2], s[3], s[4]))
	end
	return best
end

local allPolys, allBounds
local templePolys
local function ensurePolys()
	if allPolys then
		return
	end
	allPolys, allBounds = {}, {}
	templePolys = {}
	for _, a in Data.areas do
		if a.k == "temple" then
			table.insert(templePolys, toVec2List(a.pts))
		end
	end
	for i, b in Data.buildings do
		local p = toVec2List(b.pts)
		allPolys[i] = p
		local x0, x1, z0, z1 = math.huge, -math.huge, math.huge, -math.huge
		for _, q in p do
			x0, x1, z0, z1 = math.min(x0, q.X), math.max(x1, q.X), math.min(z0, q.Y), math.max(z1, q.Y)
		end
		allBounds[i] = { x0, x1, z0, z1 }
	end
end

local function insideAnyBuilding(x, z): boolean
	for i, p in allPolys do
		local bb = allBounds[i]
		if x >= bb[1] and x <= bb[2] and z >= bb[3] and z <= bb[4] and pointInPoly(x, z, p) then
			return true
		end
	end
	return false
end

function Builder.building(i: number)
	ensureRoadSegs()
	ensurePolys()
	local b = Data.buildings[i]
	local poly = allPolys[i]
	if #poly < 3 then
		return
	end
	if polyArea(poly) < 0 then
		local r = {}
		for k = #poly, 1, -1 do
			table.insert(r, poly[k])
		end
		poly = r
	end
	local area = math.abs(polyArea(poly))
	if area < 6 then
		return
	end
	local id = b.id
	-- floors and heights (estimated unless tagged)
	local lv = b.lv
	if not lv then
		if area < 70 then
			lv = rnd(id, 1) < 0.7 and 2 or 1
		elseif area < 450 then
			lv = rnd(id, 1) < 0.45 and 2 or 3
		else
			lv = rnd(id, 1) < 0.5 and 3 or 4
		end
	end
	local eave = 3.6 + (lv - 1) * 3.2
	if b.h and b.h > 2 then
		eave = b.h
		lv = math.max(1, math.floor((b.h - 3.6) / 3.2 + 1.5))
	end
	local sacred = false
	do
		local sx, sz = 0, 0
		for _, q in poly do
			sx += q.X
			sz += q.Y
		end
		sx /= #poly
		sz /= #poly
		for _, tp in templePolys do
			if pointInPoly(sx, sz, tp) then
				sacred = true
			end
		end
	end
	if sacred then
		lv = 1
		eave = (b.h and b.h > 2) and b.h or 5.2
	end
	local wallColor = sacred and Color3.fromHex("ECE6D8") or pick(PLASTER, id, 2)
	local model = Instance.new("Model")
	model.Name = "B" .. id
	model:SetAttribute("osmWayId", id)
	model:SetAttribute("heightSource", (b.h or b.lv) and "tagged" or "estimated")
	if sacred then
		model:SetAttribute("zone", "sacred-no-combat")
		model:SetAttribute("fidelity", "footprint mapped (OSM); style estimated-generic")
	end
	extrude(model, poly, 0, eave, wallColor, Enum.Material.Concrete)

	-- roof
	local mr = minRect(poly)
	local roofDef = pick(ROOFS, id, 3)
	local rectness = mr and area / (mr.L * mr.W) or 0
	if sacred and mr and rectness > 0.7 and mr.W >= 4 then
		local rise = math.clamp(mr.W * 0.34, 2, 5)
		local nx, nz = -mr.uz, mr.ux
		local half = mr.W / 2 + 0.9
		local c = Vector3.new(mr.cx, eave, mr.cz)
		local red = Color3.fromHex("B8442E")
		triPrism(model, c + Vector3.new(nx * half, 0, nz * half), c - Vector3.new(nx * half, 0, nz * half), c + Vector3.new(0, rise, 0), mr.L + 1.8, red, Enum.Material.Concrete)
		if mr.W >= 6 then
			local c2 = Vector3.new(mr.cx, eave + rise * 0.55, mr.cz)
			local h2 = mr.W * 0.28 + 0.7
			triPrism(model, c2 + Vector3.new(nx * h2, 0, nz * h2), c2 - Vector3.new(nx * h2, 0, nz * h2), c2 + Vector3.new(0, rise * 0.6, 0), mr.L * 0.72, red, Enum.Material.Concrete)
		end
		for _, side in { -1, 1 } do
			local f = c + Vector3.new(mr.ux * side * (mr.L / 2 + 0.7), rise * 0.55 + rise * 0.6 + 0.5, mr.uz * side * (mr.L / 2 + 0.7))
			box(model, Vector3.new(0.22, 1.1, 0.22), CFrame.new(f), Color3.fromHex("D9A93F"), Enum.Material.Metal, NOCOLLIDE)
		end
	elseif sacred then
		extrude(model, poly, eave, 0.3, Color3.fromHex("B8442E"), Enum.Material.Concrete)
	elseif mr and rectness > 0.82 and mr.W >= 4 and mr.W <= 16 then
		local rise = math.clamp(mr.W * 0.26, 1.2, 3.6)
		local nx, nz = -mr.uz, mr.ux
		local half = mr.W / 2 + 0.55
		local c = Vector3.new(mr.cx, eave, mr.cz)
		local a = c + Vector3.new(nx * half, 0, nz * half)
		local bpt = c - Vector3.new(nx * half, 0, nz * half)
		local apex = c + Vector3.new(0, rise, 0)
		triPrism(model, a, bpt, apex, mr.L + 1.0, roofDef[1], roofDef[2])
	else
		extrude(model, poly, eave, 0.3, Color3.fromHex("77746E"), Enum.Material.Concrete)
	end

	-- facade details per edge (sacred buildings stay plain)
	local n = #poly
	for e = 1, (sacred and 0 or n) do
		local p, q = poly[e], poly[e % n + 1]
		local d = q - p
		local L = d.Magnitude
		if L >= 3.5 then
			local dir = d / L
			local nrm = Vector2.new(dir.Y, -dir.X) -- outward for positive-area polygon
			local mid = (p + q) / 2
			if not pointInPoly(mid.X + nrm.X * 0.3, mid.Y + nrm.Y * 0.3, poly) and not insideAnyBuilding(mid.X + nrm.X * 0.9, mid.Y + nrm.Y * 0.9) then
				local face = Vector3.new(nrm.X, 0, nrm.Y)
				local rd = roadDist(mid.X, mid.Y)
				local shop = rd < 16 and L >= 4.5 and rnd(id * 7 + e, 4) < ((b.poi > 0 or b.k == "retail" or b.k == "commercial") and 0.85 or 0.4)
				local count = math.max(1, math.floor((L - 1.0) / 3.0))
				local spacing = L / count
				local shopW = shop and math.min(L - 1.6, 6.5) or 0
				-- upper floor (and ground floor when not a shop) windows
				for f = 1, lv do
					local y = f == 1 and 1.9 or (3.6 + (f - 2) * 3.2 + 1.7)
					if not (f == 1 and shop) then
						for k = 1, count do
							local pc = p + dir * ((k - 0.5) * spacing) + nrm * 0.06
							local pos = Vector3.new(pc.X, y, pc.Y)
							box(model, Vector3.new(0.95, 1.35, 0.14), CFrame.lookAt(pos, pos + face), GLASS, Enum.Material.SmoothPlastic, NOCOLLIDE)
							if f > 1 then
								local sill = Vector3.new(pc.X + nrm.X * 0.08, y - 0.78, pc.Y + nrm.Y * 0.08)
								box(model, Vector3.new(1.25, 0.1, 0.3), CFrame.lookAt(sill, sill + face), Color3.fromHex("BDB29B"), Enum.Material.Concrete, NOCOLLIDE)
							end
						end
					end
				end
				if shop then
					local pc = mid + nrm * 0.07
					local pos = Vector3.new(pc.X, 1.35, pc.Y)
					box(model, Vector3.new(shopW, 2.7, 0.14), CFrame.lookAt(pos, pos + face), Color3.fromHex("26272B"), Enum.Material.SmoothPlastic, NOCOLLIDE)
					local ap = Vector3.new(mid.X + nrm.X * 0.65, 3.0, mid.Y + nrm.Y * 0.65)
					box(model, Vector3.new(shopW + 0.7, 0.1, 1.4), CFrame.lookAt(ap, ap + face) * CFrame.Angles(math.rad(14), 0, 0), pick(AWNINGS, id * 11 + e, 5), Enum.Material.Fabric, NOCOLLIDE)
				end
			end
		end
	end
	model.Parent = folders.Buildings
end

function Builder.buildings(from: number, to: number)
	for i = from, math.min(to, #Data.buildings) do
		Builder.building(i)
	end
end

-- Plaza, paving islands, temple compound -----------------------------------------------------------
local function roadClear(x: number, z: number): number
	local best = math.huge
	for _, sg in roadSegs do
		best = math.min(best, segDist(x, z, sg[1], sg[2], sg[3], sg[4]) - sg[5])
	end
	return best
end

local function orientPositive(poly: { Vector2 }): { Vector2 }
	if polyArea(poly) >= 0 then
		return poly
	end
	local r = {}
	for k = #poly, 1, -1 do
		table.insert(r, poly[k])
	end
	return r
end

-- Placement registry: every prop/prefab asks here before it is placed, so nothing ends up in a road, inside a
-- building, on a wall/water polygon, or stacked on another object. Items are circles (oriented objects use several).
local wallObstacles, waterObstacles
local function obstaclePolys()
	if wallObstacles then
		return
	end
	wallObstacles, waterObstacles = {}, {}
	for _, w in Data.walls do
		table.insert(wallObstacles, toVec2List(w.pts))
	end
	for _, w in Data.water do
		table.insert(waterObstacles, toVec2List(w.pts))
	end
end

canPlace = function(x: number, z: number, r: number, opts: any?): boolean
	ensureRoadSegs()
	ensurePolys()
	obstaclePolys()
	local o = opts or {}
	for _, it in occ do
		local d = math.sqrt((x - it.x) ^ 2 + (z - it.z) ^ 2)
		if d < r + it.r - 1e-6 then
			if not (o.shareTag and it.tag == o.shareTag and d < (o.shareDist or 0.3)) then
				return false
			end
		end
	end
	if roadClear(x, z) < r + (o.roadMargin or 0) then
		return false
	end
	local samples = { { 0, 0 } }
	for k = 1, 4 do
		samples[k + 1] = { r * math.cos(k * math.pi / 2), r * math.sin(k * math.pi / 2) }
	end
	for _, s in samples do
		local px, pz = x + s[1], z + s[2]
		if insideAnyBuilding(px, pz) then
			return false
		end
		for _, p in wallObstacles do
			if pointInPoly(px, pz, p) then
				return false
			end
		end
		for _, p in waterObstacles do
			if pointInPoly(px, pz, p) then
				return false
			end
		end
	end
	return true
end

claim = function(x: number, z: number, r: number, tag: string)
	table.insert(occ, { x = x, z = z, r = r, tag = tag })
end

releaseTag = function(tag: string)
	for i = #occ, 1, -1 do
		if occ[i].tag == tag then
			table.remove(occ, i)
		end
	end
end

placeOk = function(x: number, z: number, r: number, tag: string, opts: any?): boolean
	if canPlace(x, z, r, opts) then
		claim(x, z, r, tag)
		return true
	end
	return false
end

-- Long thin objects (scooter, tuk-tuk): (dx, dz) is the unit axis of the long side, halfLen its half length.
placeOrientedOk = function(cx: number, cz: number, dx: number, dz: number, halfLen: number, r: number, tag: string, opts: any?): boolean
	local n = math.max(1, math.ceil(halfLen / r))
	local pts = {}
	for i = -n, n do
		local t = i / n * math.max(halfLen - r, 0)
		table.insert(pts, { cx + dx * t, cz + dz * t })
	end
	for _, p in pts do
		if not canPlace(p[1], p[2], r, opts) then
			return false
		end
	end
	for _, p in pts do
		claim(p[1], p[2], r, tag)
	end
	return true
end

local function lamp(parent, x: number, z: number, ox: number, oz: number)
	cylinderUp(parent, 0.16, 5.0, Vector3.new(x, 2.5, z), Color3.fromHex("3A3D40"), Enum.Material.Metal)
	box(parent, Vector3.new(0.5, 0.15, 0.3), CFrame.new(x + ox * 0.5, 5.05, z + oz * 0.5), Color3.fromHex("F3E2B0"), Enum.Material.Neon, NOCOLLIDE)
	box(parent, Vector3.new(0.9, 0.1, 0.1), CFrame.lookAt(Vector3.new(x + ox * 0.4, 5.1, z + oz * 0.4), Vector3.new(x + ox, 5.1, z + oz)), Color3.fromHex("3A3D40"), Enum.Material.Metal, NOCOLLIDE)
end

local function bench(parent, x: number, z: number, fx: number, fz: number)
	local cf = CFrame.lookAt(Vector3.new(x, 0.15, z), Vector3.new(x + fx, 0.15, z + fz))
	local wood, steel = Color3.fromHex("8A6A47"), Color3.fromHex("34363A")
	box(parent, Vector3.new(1.8, 0.08, 0.5), cf * CFrame.new(0, 0.46, 0), wood, Enum.Material.Wood)
	box(parent, Vector3.new(1.8, 0.45, 0.06), cf * CFrame.new(0, 0.78, 0.23), wood, Enum.Material.Wood, NOCOLLIDE)
	for _, sx in { -0.75, 0.75 } do
		box(parent, Vector3.new(0.08, 0.46, 0.45), cf * CFrame.new(sx, 0.23, 0), steel, Enum.Material.Metal, NOCOLLIDE)
	end
end

local function temple(a)
	local poly = orientPositive(toVec2List(a.pts))
	local model = Instance.new("Model")
	model.Name = "Temple_" .. tostring(a.id)
	model:SetAttribute("osmWayId", a.id)
	model:SetAttribute("osmName", a.name)
	model:SetAttribute("zone", "sacred-no-combat")
	model:SetAttribute("fidelity", "estimated-generic: not a replica; no survey or reference photos used")
	extrude(model, poly, 0, 0.14, Color3.fromHex("CFC8B8"), Enum.Material.Pavement)
	local n = #poly
	-- boundary wall with a gate gap on the edge nearest a road
	local gapEdge, gapD = 1, math.huge
	for e = 1, n do
		local mid = (poly[e] + poly[e % n + 1]) / 2
		local d = roadClear(mid.X, mid.Y)
		if d < gapD then
			gapEdge, gapD = e, d
		end
	end
	local white = Color3.fromHex("ECE6D8")
	local function wallSeg(p: Vector2, q: Vector2)
		local d = q - p
		if d.Magnitude > 0.3 then
			local m = (p + q) / 2
			local pos = Vector3.new(m.X, 0.14 + 0.95, m.Y)
			box(model, Vector3.new(0.5, 1.9, d.Magnitude), CFrame.lookAt(pos, pos + Vector3.new(d.X, 0, d.Y)), white, Enum.Material.Concrete)
			box(model, Vector3.new(0.7, 0.12, d.Magnitude), CFrame.lookAt(pos + Vector3.new(0, 1.0, 0), pos + Vector3.new(d.X, 1.0, d.Y)), Color3.fromHex("B8442E"), Enum.Material.Concrete, NOCOLLIDE)
		end
	end
	for e = 1, n do
		local p, q = poly[e], poly[e % n + 1]
		if e == gapEdge then
			local dir = (q - p).Unit
			local mid = (p + q) / 2
			wallSeg(p, mid - dir * 3.5)
			wallSeg(mid + dir * 3.5, q)
		else
			wallSeg(p, q)
		end
	end
	-- shade trees (avoid real building footprints)
	local mr = minRect(poly)
	if mr then
		local ux, uz = mr.ux, mr.uz
		local nx, nz = -uz, ux
		local greens = { Color3.fromHex("4F7A45"), Color3.fromHex("5E8C4A"), Color3.fromHex("3F6B3C") }
		for k = 1, 8 do
			local tx = mr.cx + ux * (rnd(a.id, k) - 0.5) * mr.L * 0.85 + nx * (rnd(a.id, k + 9) - 0.5) * mr.W * 0.85
			local tz = mr.cz + uz * (rnd(a.id, k) - 0.5) * mr.L * 0.85 + nz * (rnd(a.id, k + 9) - 0.5) * mr.W * 0.85
			if pointInPoly(tx, tz, poly) and not insideAnyBuilding(tx, tz) and not insideAnyBuilding(tx + 3, tz) and not insideAnyBuilding(tx - 3, tz) and not insideAnyBuilding(tx, tz + 3) and not insideAnyBuilding(tx, tz - 3) then
				cylinderUp(model, 0.4, 3.4, Vector3.new(tx, 1.7, tz), Color3.fromHex("6A5238"), Enum.Material.Wood)
				ball(model, 6.0, Vector3.new(tx, 5.3, tz), pick(greens, a.id, k), Enum.Material.Grass, NOCOLLIDE)
			end
		end
	end
	model.Parent = folders.Props
end

function Builder.places()
	ensureRoadSegs()
	ensurePolys()
	local wallPolys = {}
	for _, w in Data.walls do
		table.insert(wallPolys, toVec2List(w.pts))
	end
	for _, a in Data.areas do
		local poly = orientPositive(toVec2List(a.pts))
		if a.k == "plaza" then
			extrude(folders.Ground, poly, 0, 0.13, Color3.fromHex("BDB6A6"), Enum.Material.Concrete)
			local x0, x1, z0, z1 = math.huge, -math.huge, math.huge, -math.huge
			for _, q in poly do
				x0, x1, z0, z1 = math.min(x0, q.X), math.max(x1, q.X), math.min(z0, q.Y), math.max(z1, q.Y)
			end
			-- Concrete-plate joints (OSM surface=concrete:plates): thin dark lines every 2 m, clipped to the plaza,
			-- roads and walls, plus a kerb stone along the plaza edge wherever it meets a road.
			local STEP = 2.0
			local jointColor = Color3.fromHex("8F8A7E")
			local function free(px: number, pz: number): boolean
				if not pointInPoly(px, pz, poly) or roadClear(px, pz) < 0.35 then
					return false
				end
				for _, wp in wallPolys do
					if pointInPoly(px, pz, wp) then
						return false
					end
				end
				return true
			end
			local function emit(fixed: number, vertical: boolean, a: number, b: number)
				if b - a > 0.4 then
					local mid, len = (a + b) / 2, b - a + 0.5
					if vertical then
						box(folders.Ground, Vector3.new(0.05, 0.012, len), CFrame.new(fixed, 0.136, mid), jointColor, Enum.Material.Concrete, NOCOLLIDE)
					else
						box(folders.Ground, Vector3.new(len, 0.012, 0.05), CFrame.new(mid, 0.136, fixed), jointColor, Enum.Material.Concrete, NOCOLLIDE)
					end
				end
			end
			local function scanLine(fixed: number, vertical: boolean, lo: number, hi: number)
				local a, b
				local t = lo
				while t <= hi do
					local px, pz = vertical and fixed or t, vertical and t or fixed
					if free(px, pz) then
						a = a or t
						b = t
					elseif a then
						emit(fixed, vertical, a, b)
						a, b = nil, nil
					end
					t += 0.5
				end
				if a then
					emit(fixed, vertical, a, b)
				end
			end
			for x = math.ceil(x0 / STEP) * STEP, x1, STEP do
				scanLine(x, true, z0, z1)
			end
			for z = math.ceil(z0 / STEP) * STEP, z1, STEP do
				scanLine(z, false, x0, x1)
			end
			for e = 1, #poly do
				local p, q = poly[e], poly[e % #poly + 1]
				local d = q - p
				local len = d.Magnitude
				if len > 1 then
					local dir = d / len
					local s = 1.0
					while s < len - 0.5 do
						local c = p + dir * s
						local cl = roadClear(c.X, c.Y)
						if cl > -0.1 and cl < 1.2 then
							local pos = Vector3.new(c.X, 0.2, c.Y)
							box(folders.Ground, Vector3.new(0.25, 0.2, 2.0), CFrame.lookAt(pos, pos + Vector3.new(dir.X, 0, dir.Y)), Color3.fromHex("CFCBC0"), Enum.Material.Concrete)
						end
						s += 2.0
					end
				end
			end
			-- benches and lamps around the edge, facing into the plaza
			local n = #poly
			for e = 1, n do
				local p, q = poly[e], poly[e % n + 1]
				local d = q - p
				local len = d.Magnitude
				if len > 12 then
					local dir = d / len
					local inward = Vector2.new(-dir.Y, dir.X)
					local sdist = 8
					local k = 0
					while sdist < len - 6 do
						k += 1
						local c = p + dir * sdist + inward * 1.6
						if roadClear(c.X, c.Y) > 2.5 and pointInPoly(c.X, c.Y, poly) and placeOk(c.X, c.Y, k % 2 == 0 and 0.9 or 0.3, "plaza") then
							if k % 2 == 0 then
								bench(folders.Props, c.X, c.Y, inward.X, inward.Y)
							else
								lamp(folders.Props, c.X, c.Y, inward.X, inward.Y)
							end
						end
						sdist += 14
					end
				end
			end
		elseif a.k == "paving" then
			extrude(folders.Ground, poly, 0, 0.14, Color3.fromHex("C2B49B"), Enum.Material.Cobblestone)
		elseif a.k == "temple" then
			temple(a)
		end
	end
	for _, pr in Data.props do
		if pr.k == "toilets" then
			box(folders.Props, Vector3.new(4.0, 3.0, 3.0), CFrame.new(pr.x, 1.5, pr.z), Color3.fromHex("D8D2C4"), Enum.Material.Concrete)
			box(folders.Props, Vector3.new(4.4, 0.25, 3.4), CFrame.new(pr.x, 3.1, pr.z), Color3.fromHex("6B6F73"), Enum.Material.Concrete, NOCOLLIDE)
		end
	end
end

-- Street decor: parked scooters, trash cans (free prefabs) and concrete planters (procedural; the free plant pack
-- merged into one block and was rejected). Placement is ESTIMATED (shop-facing building edges near roads) but every
-- item must pass the placement registry: not in a road, not in a building, not stacked on another object.
function Builder.streetDecor()
	ensureRoadSegs()
	ensurePolys()
	for _, tag in { "scooter", "planter", "bin" } do
		releaseTag(tag)
	end
	local old = root:FindFirstChild("StreetDecor")
	if old then
		old:Destroy()
	end
	local group = Instance.new("Folder")
	group.Name = "StreetDecor"
	group.Parent = root
	local swSegs = {}
	for _, sw in Data.sidewalks do
		local v = toVec2List(sw.pts)
		for i = 1, #v - 1 do
			table.insert(swSegs, { v[i].X, v[i].Y, v[i + 1].X, v[i + 1].Y })
		end
	end
	local function groundY(x: number, z: number): number
		for _, s in swSegs do
			if segDist(x, z, s[1], s[2], s[3], s[4]) < 1.0 then
				return SIDEWALK_TOP
			end
		end
		if roadClear(x, z) < 0 then
			return ROAD_TOP
		end
		return 0
	end
	local scooters, bins, planters = 0, 0, 0
	local MAX_S, MAX_B, MAX_P = 14, 12, 22
	local function planter(x: number, z: number, id: number)
		local y = groundY(x, z)
		local pot = Color3.fromHex("B5654A")
		cylinderUp(group, 0.7, 0.55, Vector3.new(x, y + 0.275, z), pot, Enum.Material.Concrete)
		cylinderUp(group, 0.62, 0.05, Vector3.new(x, y + 0.55, z), Color3.fromHex("4A3A2C"), Enum.Material.Ground, NOCOLLIDE)
		ball(group, 0.95, Vector3.new(x, y + 0.95, z), Color3.fromHex("4F7A45"), Enum.Material.Grass, NOCOLLIDE)
		ball(group, 0.6, Vector3.new(x + 0.12, y + 1.22, z - 0.05), Color3.fromHex("5E8C4A"), Enum.Material.Grass, NOCOLLIDE)
		if rnd(id, 90) < 0.6 then
			ball(group, 0.2, Vector3.new(x - 0.18, y + 1.25, z + 0.2), pick({ Color3.fromHex("D9467A"), Color3.fromHex("E8A33D"), Color3.fromHex("F2F0E6") }, id, 91), Enum.Material.SmoothPlastic, NOCOLLIDE)
		end
	end
	for i, b in Data.buildings do
		local poly = orientPositive(allPolys[i])
		local n = #poly
		local sacred = false
		for _, tp in templePolys do
			if pointInPoly(poly[1].X, poly[1].Y, tp) then
				sacred = true
			end
		end
		if not sacred then
			for e = 1, n do
				local p, q = poly[e], poly[e % n + 1]
				local d = q - p
				local L = d.Magnitude
				if L >= 6 then
					local dir = d / L
					local nrm = Vector2.new(dir.Y, -dir.X)
					local mid = (p + q) / 2
					if not pointInPoly(mid.X + nrm.X * 0.3, mid.Y + nrm.Y * 0.3, poly) and not insideAnyBuilding(mid.X + nrm.X * 0.9, mid.Y + nrm.Y * 0.9) and roadDist(mid.X, mid.Y) < 16 then
						local r1 = rnd(b.id * 13 + e, 40)
						if r1 < 0.35 then
							-- scooters parked nose-to-street, side by side (the long side is perpendicular to the wall)
							local count = 1 + math.floor(rnd(b.id * 13 + e, 41) * 3)
							for k = 1, count do
								local c = mid + nrm * 1.3 + dir * ((k - (count + 1) / 2) * 1.0)
								if scooters < MAX_S and placeOrientedOk(c.X, c.Y, nrm.X, nrm.Y, 1.08, 0.33, "scooter") then
									spawnPrefab("Scooter", c.X, c.Y, math.atan2(nrm.X, nrm.Y) + (rnd(b.id * 13 + e, 42 + k) - 0.5) * 0.25, 1, group, groundY(c.X, c.Y))
									scooters += 1
								end
							end
						elseif r1 < 0.7 and planters < MAX_P then
							for _, sgn in { -1, 1 } do
								local c = mid + nrm * 0.7 + dir * sgn * math.min(L / 2 - 0.8, 3.6)
								if planters < MAX_P and placeOk(c.X, c.Y, 0.45, "planter") then
									planter(c.X, c.Y, b.id * 3 + e + sgn)
									planters += 1
								end
							end
						elseif r1 > 0.9 and bins < MAX_B then
							local c = mid + nrm * 0.5 + dir * (L / 2 - 1.0)
							if placeOk(c.X, c.Y, 0.35, "bin") then
								spawnPrefab("TrashCan", c.X, c.Y, rnd(b.id, e) * 6.28, 1, group, groundY(c.X, c.Y))
								bins += 1
							end
						end
					end
				end
			end
		end
	end
	-- a few bins along the plaza edge
	for _, a in Data.areas do
		if a.k == "plaza" then
			local poly = orientPositive(toVec2List(a.pts))
			local n = #poly
			for e = 1, n do
				local p, q = poly[e], poly[e % n + 1]
				local d = q - p
				local len = d.Magnitude
				if len > 20 then
					local dir = d / len
					local inward = Vector2.new(-dir.Y, dir.X)
					local s = 14
					while s < len - 8 and bins < MAX_B + 6 do
						local c = p + dir * s + inward * 1.2
						if pointInPoly(c.X, c.Y, poly) and placeOk(c.X, c.Y, 0.35, "bin") then
							spawnPrefab("TrashCan", c.X, c.Y, math.atan2(inward.X, inward.Y), 1, group, 0.13)
							bins += 1
						end
						s += 30
					end
				end
			end
		end
	end
	return { scooters = scooters, bins = bins, planters = planters }
end

-- Atmosphere effects: drifting dust motes over the plaza (engine ParticleEmitter, no external asset).
function Builder.vfx()
	local old = root:FindFirstChild("Vfx")
	if old then
		old:Destroy()
	end
	local f = Instance.new("Folder")
	f.Name = "Vfx"
	local part = Instance.new("Part")
	part.Name = "PlazaDust"
	part.Anchored = true
	part.CanCollide = false
	part.CanQuery = false
	part.CanTouch = false
	part.Transparency = 1
	part.Size = Vector3.new(90, 9, 150) / STUD
	part.Position = Vector3.new(20 / STUD, 4.5 / STUD, 20 / STUD)
	part.Parent = f
	local pe = Instance.new("ParticleEmitter")
	pe.Name = "DustMotes"
	pe.Shape = Enum.ParticleEmitterShape.Box
	pe.Rate = 9
	pe.Lifetime = NumberRange.new(9, 15)
	pe.Speed = NumberRange.new(0.15, 0.5)
	pe.SpreadAngle = Vector2.new(180, 180)
	pe.Size = NumberSequence.new(0.1)
	pe.Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 1), NumberSequenceKeypoint.new(0.2, 0.7), NumberSequenceKeypoint.new(0.8, 0.7), NumberSequenceKeypoint.new(1, 1) })
	pe.Color = ColorSequence.new(Color3.fromHex("FFE9C4"))
	pe.LightEmission = 0.5
	pe.LightInfluence = 0
	pe.Acceleration = Vector3.new(0.08, 0.04, 0.05)
	pe.Drag = 1
	pe.Parent = part
	f.Parent = root
	return true
end

-- Road and pavement details: white edge lines, manhole covers and kerb strips along sidewalks.
-- All estimated from OSM road class/lanes; skips places that fall inside another road (junctions).
function Builder.roadDetails()
	ensureRoadSegs()
	local function clearOthers(x: number, z: number, id: number): number
		local best = math.huge
		for _, sg in roadSegs do
			if sg[6] ~= id then
				best = math.min(best, segDist(x, z, sg[1], sg[2], sg[3], sg[4]) - sg[5])
			end
		end
		return best
	end
	local old = folders.Markings:FindFirstChild("RoadDetails")
	if old then
		old:Destroy()
	end
	local group = Instance.new("Folder")
	group.Name = "RoadDetails"
	group.Parent = folders.Markings
	local edge, manholes, kerbs = 0, 0, 0
	local WHITE_E = Color3.fromHex("E6E6DE")
	for _, r in Data.roads do
		local major = (r.hw == "secondary" or r.hw == "tertiary" or r.hw == "primary") or (r.hw == "residential" and r.lanes >= 2)
		if major then
			local w = roadWidth(r)
			local v = toVec2List(r.pts)
			local sinceManhole = 20
			for i = 1, #v - 1 do
				local a, b = v[i], v[i + 1]
				local d = b - a
				local len = d.Magnitude
				if len > 1 then
					local dir = d / len
					local nrm = Vector2.new(-dir.Y, dir.X)
					local s = 0.0
					while s + 4 <= len do
						local mid = a + dir * (s + 2)
						for _, side in { -1, 1 } do
							local c = mid + nrm * side * (w / 2 - 0.35)
							if clearOthers(c.X, c.Y, r.id) > 0.8 then
								local pos = Vector3.new(c.X, ROAD_TOP + 0.025, c.Y)
								box(group, Vector3.new(0.12, 0.05, 4.0), CFrame.lookAt(pos, pos + Vector3.new(dir.X, 0, dir.Y)), WHITE_E, Enum.Material.SmoothPlastic, NOCOLLIDE)
								edge += 1
							end
						end
						sinceManhole += 4
						if sinceManhole >= 45 then
							local c = mid + nrm * (w / 4)
							if clearOthers(c.X, c.Y, r.id) > 1.0 then
								cylinderUp(group, 0.7, 0.05, Vector3.new(c.X, ROAD_TOP + 0.025, c.Y), Color3.fromHex("35363A"), Enum.Material.Metal, NOCOLLIDE)
								manholes += 1
								sinceManhole = 0
							end
						end
						s += 4
					end
				end
			end
		end
	end
	for _, sw in Data.sidewalks do
		local v = toVec2List(sw.pts)
		for i = 1, #v - 1 do
			local a, b = v[i], v[i + 1]
			local d = b - a
			local len = d.Magnitude
			if len > 0.3 then
				local dir = d / len
				local nrm = Vector2.new(-dir.Y, dir.X)
				local mid = (a + b) / 2
				for _, side in { -1, 1 } do
					local c = mid + nrm * side * 0.95
					local pos = Vector3.new(c.X, SIDEWALK_TOP + 0.03, c.Y)
					box(group, Vector3.new(0.18, 0.06, len), CFrame.lookAt(pos, pos + Vector3.new(dir.X, 0, dir.Y)), Color3.fromHex("DAD6CA"), Enum.Material.Concrete, NOCOLLIDE)
					kerbs += 1
				end
			end
		end
	end
	return { edgeLines = edge, manholes = manholes, kerbs = kerbs }
end

-- Street lamps (estimated placement): ~30 m apart on the right-hand verge of larger roads. Skips spots that fall
-- inside any road, building, wall or the plaza (the plaza has its own lamps).
function Builder.lamps()
	releaseTag("lamp")
	ensureRoadSegs()
	ensurePolys()
	local wallPolys, plazaPolys = {}, {}
	for _, w in Data.walls do
		table.insert(wallPolys, toVec2List(w.pts))
	end
	for _, a in Data.areas do
		if a.k == "plaza" then
			table.insert(plazaPolys, toVec2List(a.pts))
		end
	end
	local function blockedAt(x: number, z: number): boolean
		if insideAnyBuilding(x, z) or roadClear(x, z) < 0.6 then
			return true
		end
		for _, p in wallPolys do
			if pointInPoly(x, z, p) then
				return true
			end
		end
		for _, p in plazaPolys do
			if pointInPoly(x, z, p) then
				return true
			end
		end
		return false
	end
	local old = folders.Props:FindFirstChild("StreetLamps")
	if old then
		old:Destroy()
	end
	local group = Instance.new("Folder")
	group.Name = "StreetLamps"
	group.Parent = folders.Props
	local n = 0
	for _, r in Data.roads do
		if r.hw == "secondary" or r.hw == "tertiary" then
			local v = toVec2List(r.pts)
			local w = roadWidth(r)
			local acc = 12
			for i = 1, #v - 1 do
				local a, b = v[i], v[i + 1]
				local d = b - a
				local len = d.Magnitude
				if len > 1 then
					local dir = d / len
					local nrm = Vector2.new(dir.Y, -dir.X) -- right-hand side
					local s = acc
					while s < len do
						local c = a + dir * s + nrm * (w / 2 + 1.4)
						if not blockedAt(c.X, c.Y) and placeOk(c.X, c.Y, 0.3, "lamp") then
							n += 1
							cylinderUp(group, 0.16, 6.0, Vector3.new(c.X, 3.0, c.Y), Color3.fromHex("3A3D40"), Enum.Material.Metal)
							-- arm reaches over the road, lamp head at its end
							local head = Vector3.new(c.X - nrm.X * 0.7, 6.1, c.Y - nrm.Y * 0.7)
							box(group, Vector3.new(1.4, 0.12, 0.12), CFrame.lookAt(head, head + Vector3.new(nrm.X, 0, nrm.Y)) * CFrame.Angles(0, math.rad(90), 0), Color3.fromHex("3A3D40"), Enum.Material.Metal, NOCOLLIDE)
							box(group, Vector3.new(0.5, 0.15, 0.3), CFrame.new(c.X - nrm.X * 1.3, 6.0, c.Y - nrm.Y * 1.3), Color3.fromHex("F3E2B0"), Enum.Material.Neon, NOCOLLIDE)
							-- street-name board on every 2nd lamp (public road name from OSM; Thai on top, English below)
							if n % 2 == 0 and r.nm then
								local pos = Vector3.new(c.X, 4.6, c.Y)
								local board = box(group, Vector3.new(0.06, 0.5, 1.5), CFrame.lookAt(pos - Vector3.new(nrm.X * 0.14, 0, nrm.Y * 0.14), pos + Vector3.new(nrm.X, 0, nrm.Y)) * CFrame.Angles(0, math.rad(90), 0), Color3.fromHex("1F4E8C"), Enum.Material.SmoothPlastic, NOCOLLIDE)
								board.Name = "StreetSign"
								for _, face in { Enum.NormalId.Right, Enum.NormalId.Left } do
									local gui = Instance.new("SurfaceGui")
									gui.Face = face
									gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
									gui.PixelsPerStud = 50
									gui.Parent = board
									local lbl = Instance.new("TextLabel")
									lbl.Size = UDim2.fromScale(1, 1)
									lbl.BackgroundTransparency = 1
									lbl.TextColor3 = Color3.new(1, 1, 1)
									lbl.TextScaled = true
									lbl.Font = Enum.Font.BuilderSansBold
									lbl.Text = r.nm .. (r.en and ("\n" .. r.en) or "")
									lbl.Parent = gui
								end
							end
						end
						s += 30
					end
					acc = s - len
				end
			end
		end
	end
	return n
end

-- Utility poles with wires along larger roads, and parked tuk-tuks (free prefabs, estimated placement).
function Builder.freeAssets()
	ensureRoadSegs()
	ensurePolys()
	releaseTag("pole")
	releaseTag("tuktuk")
	local plazaPolys = {}
	for _, a in Data.areas do
		if a.k == "plaza" then
			table.insert(plazaPolys, toVec2List(a.pts))
		end
	end
	local function inPlaza(x: number, z: number): boolean
		for _, p in plazaPolys do
			if pointInPoly(x, z, p) then
				return true
			end
		end
		return false
	end
	local f = root:FindFirstChild("FreeAssets")
	if f then
		f:Destroy()
	end
	f = Instance.new("Folder")
	f.Name = "FreeAssets"
	f.Parent = root
	local poles, tuk = 0, 0
	local protoPole = prefab("PolePair")
	if protoPole then
		-- distance between the two poles of the prefab, so chained pairs meet exactly (no doubled poles)
		local SPAN = 23.0
		local centers = {}
		for _, c in protoPole:GetChildren() do
			if c:IsA("Model") then
				table.insert(centers, c:GetBoundingBox().Position)
			end
		end
		if #centers == 2 then
			SPAN = (centers[1] - centers[2]).Magnitude * STUD
		end
		local share = { shareTag = "pole", shareDist = 0.3, roadMargin = 0.8 }
		for _, r in Data.roads do
			if r.hw == "secondary" or r.hw == "tertiary" then
				local v = toVec2List(r.pts)
				local lat = roadWidth(r) / 2 + 3.4
				for i = 1, #v - 1 do
					local a, b = v[i], v[i + 1]
					local d = b - a
					local len = d.Magnitude
					if len >= SPAN + 1 then
						local dir = d / len
						local nrm = Vector2.new(dir.Y, -dir.X)
						local s = 0.5
						while s + SPAN <= len do
							local c = a + dir * (s + SPAN / 2) + nrm * lat
							local e1, e2 = c - dir * (SPAN / 2), c + dir * (SPAN / 2)
							if not inPlaza(e1.X, e1.Y) and not inPlaza(e2.X, e2.Y) and canPlace(e1.X, e1.Y, 0.35, share) and canPlace(e2.X, e2.Y, 0.35, share) then
								claim(e1.X, e1.Y, 0.35, "pole")
								claim(e2.X, e2.Y, 0.35, "pole")
								spawnPrefab("PolePair", c.X, c.Y, math.atan2(dir.X, dir.Y), 1, f)
								poles += 1
							end
							s += SPAN
						end
					end
				end
			end
		end
	end
	-- tuk-tuks wait at the plaza edge (a taxi stand beside the gate), never in a lane
	if prefab("TukTuk") then
		for _, a in Data.areas do
			if a.k == "plaza" then
				local poly = orientPositive(toVec2List(a.pts))
				local n = #poly
				for e = 1, n do
					local p, q = poly[e], poly[e % n + 1]
					local d = q - p
					local len = d.Magnitude
					if len > 40 and tuk < 2 then
						local dir = d / len
						local inward = Vector2.new(-dir.Y, dir.X)
						local s = 12
						while s < len - 8 and tuk < 2 do
							local c = p + dir * s + inward * 3.0
							if placeOrientedOk(c.X, c.Y, dir.X, dir.Y, 2.4, 1.1, "tuktuk") then
								spawnPrefab("TukTuk", c.X, c.Y, math.atan2(dir.X, dir.Y), 1, f, 0.13)
								tuk += 1
								s += 8
							else
								s += 3
							end
						end
					end
				end
			end
		end
	end
	return { poles = poles, tuktuks = tuk }
end

-- Plaza ambience loop (free Roblox audio library asset 9112786813, see roblox/assets/third-party-assets.md).
-- Optional: uses ServerStorage.AssetQuarantine.AmbiencePlaza_9112786813 when present, otherwise skipped.
function Builder.audio()
	local src = game:GetService("ServerStorage"):FindFirstChild("AssetQuarantine")
	src = src and src:FindFirstChild("AmbiencePlaza_9112786813")
	if not src then
		return false
	end
	local old = root:FindFirstChild("Audio")
	if old then
		old:Destroy()
	end
	local f = Instance.new("Folder")
	f.Name = "Audio"
	local anchor = Instance.new("Part")
	anchor.Name = "PlazaAmbienceEmitter"
	anchor.Anchored = true
	anchor.CanCollide = false
	anchor.CanQuery = false
	anchor.CanTouch = false
	anchor.Transparency = 1
	anchor.Size = Vector3.new(1, 1, 1)
	anchor.Position = Vector3.new(20 / STUD, 4, 20 / STUD)
	anchor.Parent = f
	local s = src:Clone()
	s.Name = "PlazaAmbience"
	s.Looped = true
	s.Volume = 0.35
	s.RollOffMode = Enum.RollOffMode.Linear
	s.RollOffMinDistance = 40
	s.RollOffMaxDistance = 260
	s.Playing = true
	s.Parent = anchor
	-- soft bird ambience near the trees (free library asset 9116971175)
	local birds = game:GetService("ServerStorage").AssetQuarantine:FindFirstChild("AmbienceBirds_9116971175")
	if birds then
		local a2 = Instance.new("Part")
		a2.Name = "BirdAmbienceEmitter"
		a2.Anchored = true
		a2.CanCollide = false
		a2.CanQuery = false
		a2.CanTouch = false
		a2.Transparency = 1
		a2.Size = Vector3.new(1, 1, 1)
		a2.Position = Vector3.new(12 / STUD, 7 / STUD, 30 / STUD)
		a2.Parent = f
		local sb = birds:Clone()
		sb.Name = "BirdAmbience"
		sb.Looped = true
		sb.Volume = 0.18
		sb.RollOffMode = Enum.RollOffMode.Linear
		sb.RollOffMinDistance = 30
		sb.RollOffMaxDistance = 180
		sb.Playing = true
		sb.Parent = a2
	end
	f.Parent = root
	return true
end

function Builder.spawn()
	local old = root:FindFirstChild("SpawnLocation")
	if old then
		old:Destroy()
	end
	local target = Vector2.new(14, 6)
	local best, bestD = Vector2.new(14, 6), math.huge
	for _, r in Data.roads do
		if r.hw == "secondary" or r.hw == "tertiary" or r.hw == "residential" then
			for _, v in toVec2List(r.pts) do
				local d = (v - target).Magnitude
				if d < bestD then
					best, bestD = v, d
				end
			end
		end
	end
	local s = Instance.new("SpawnLocation")
	s.Name = "SpawnLocation"
	s.Anchored = true
	s.Size = Vector3.new(6, 1, 6)
	s.Transparency = 1
	s.CanCollide = false
	s.Duration = 0
	s.CFrame = CFrame.lookAt(Vector3.new(best.X / STUD, (ROAD_TOP + 0.6) / STUD, best.Y / STUD), Vector3.new(0, (ROAD_TOP + 0.6) / STUD, 0))
	s.Parent = root
end

function Builder.lighting()
	Lighting.ClockTime = 17.3 -- golden evening
	Lighting.Brightness = 2.6
	Lighting.GeographicLatitude = 18.8
	Lighting.EnvironmentDiffuseScale = 0.6
	Lighting.EnvironmentSpecularScale = 0.4
	local atm = Lighting:FindFirstChildOfClass("Atmosphere")
	if atm then
		atm.Density = 0.32
		atm.Haze = 1.8
		atm.Color = Color3.fromHex("F2D9B0")
		atm.Decay = Color3.fromHex("F0A870")
	end
	local cc = Lighting:FindFirstChild("EchoAtlasGrade") or Instance.new("ColorCorrectionEffect")
	cc.Name = "EchoAtlasGrade"
	cc.TintColor = Color3.fromHex("FFE2C0")
	cc.Saturation = 0.1
	cc.Contrast = 0.05
	cc.Parent = Lighting
	local rays = Lighting:FindFirstChildOfClass("SunRaysEffect")
	if rays then
		rays.Intensity = 0.2
		rays.Spread = 0.8
	end
end

return Builder

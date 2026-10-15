--!strict
-- Pure-logic unit tests (damage, combo, rate limiter, Config sanity). Run in Studio via the Studio MCP:
--   require(game.ServerStorage.EchoAtlas.UnitTests).run()
-- These test rules only. They do NOT test feel, multiplayer replication, or real devices.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared:WaitForChild("Config"))
local DamageMath = require(Shared:WaitForChild("DamageMath"))
local ComboLogic = require(Shared:WaitForChild("ComboLogic"))
local RateLimiter = require(Shared:WaitForChild("RateLimiter"))

local Tests = {}

function Tests.run(): { passed: number, failed: number, failures: { string } }
	local passed, failed = 0, 0
	local failures: { string } = {}
	local function check(name: string, cond: boolean, detail: string?)
		if cond then
			passed += 1
		else
			failed += 1
			table.insert(failures, name .. (detail and (": " .. detail) or ""))
		end
	end
	local function eq(name: string, got: any, want: any)
		check(name, got == want, ("got %s want %s"):format(tostring(got), tostring(want)))
	end

	-- DamageMath
	eq("level-1 combo 1 = 12", DamageMath.hit(12, 12, 0), 12)
	eq("level-1 combo 3 = 20", DamageMath.hit(20, 12, 0), 20)
	eq("defense 100 halves damage", DamageMath.hit(20, 12, 100), 10)
	eq("attackRating 24 doubles", DamageMath.hit(12, 24, 0), 24)
	eq("rounds half up", DamageMath.hit(13, 12, 100), 7)
	eq("negative base clamps to 0", DamageMath.hit(-5, 12, 0), 0)
	eq("NaN base is 0", DamageMath.hit(0 / 0, 12, 0), 0)
	eq("inf attackRating is 0 (not inf)", DamageMath.hit(12, math.huge, 0), 0)
	eq("negative defense does not amplify", DamageMath.hit(12, 12, -50), 12)

	-- ComboLogic
	local win, max = Config.combat.sequenceWindow, #Config.combat.steps
	eq("first swing is step 1", ComboLogic.nextStep(0, 99, win, max), 1)
	eq("within window continues", ComboLogic.nextStep(1, 0.4, win, max), 2)
	eq("step 2 -> 3", ComboLogic.nextStep(2, 0.5, win, max), 3)
	eq("after last step wraps to 1", ComboLogic.nextStep(3, 0.2, win, max), 1)
	eq("window expired resets", ComboLogic.nextStep(2, win + 0.01, win, max), 1)
	eq("NaN elapsed resets", ComboLogic.nextStep(2, 0 / 0, win, max), 1)

	-- RateLimiter (clock injected)
	local rl = RateLimiter.new(4, 6)
	local allowed = 0
	for _ = 1, 10 do
		if rl:allow("p", 0) then
			allowed += 1
		end
	end
	eq("burst limited to capacity", allowed, 4)
	check("refills over time", rl:allow("p", 1), "expected allow after 1 s")
	eq("separate keys are independent", rl:allow("q", 0), true)
	rl:remove("p")
	eq("removed key starts full", rl:allow("p", 1), true)

	-- Config sanity (catches typos in balance edits)
	check("combo has 3 steps", max == 3)
	for i, s in Config.combat.steps do
		check("step " .. i .. " damage > 0", s.damage > 0)
		check("step " .. i .. " hitDelay < duration", s.hitDelay < s.duration)
	end
	check("slime windup is the teaching 0.8 s", Config.enemies.slime.windup == 0.8)
	check("slime pounces inside its notice range", Config.enemies.slime.attackTrigger < Config.enemies.slime.noticeRange)
	check("leash > notice range", Config.enemies.slime.leash > Config.enemies.slime.noticeRange)
	check("player can survive at least 5 slime hits", Config.player.maxHp / DamageMath.hit(Config.enemies.slime.damage, 12, 0) >= 5)

	return { passed = passed, failed = failed, failures = failures }
end

return Tests

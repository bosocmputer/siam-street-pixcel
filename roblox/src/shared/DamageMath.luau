--!strict
-- Pure damage math (no Roblox services) so it can be unit-tested.
-- damage = baseActionDamage * attackRating / 12 * 100 / (100 + defense), rounded once at the end (docs/03 §2).
-- Callers must still validate remote input; this only guards against NaN/negative values.

local DamageMath = {}

local function finite(n: number, fallback: number): number
	if n ~= n or n == math.huge or n == -math.huge then
		return fallback
	end
	return n
end

function DamageMath.hit(baseDamage: number, attackRating: number, defense: number): number
	baseDamage = math.max(0, finite(baseDamage, 0))
	attackRating = math.max(0, finite(attackRating, 0))
	defense = math.max(0, finite(defense, 0))
	local scaled = baseDamage * attackRating / 12
	return math.max(0, math.floor(scaled * 100 / (100 + defense) + 0.5))
end

return DamageMath

--!strict
-- Balance and tuning for the first combat slice (R01-R02). EVERY number here is a PROPOSAL / test value taken from
-- docs/roblox/02-combat-and-classes.md and 03-rpg-and-social-systems.md; none has been play-tested for feel.
-- Units: studs and seconds (map conversion 1 stud = 0.28 m happens only in the world builder).

export type ComboStep = { damage: number, hitDelay: number, duration: number }

local Config = {
	-- Feature switches. combat = sword, attack input/button, slimes, the combat HUD. The creator switched it OFF on
	-- 2026-10-15 to polish and explore the map first; set it back to true to restore all of it (no code was removed).
	features = {
		combat = false,
	},

	player = {
		maxHp = 120,
		attackRating = 12, -- level 1 with the training sword (docs/03 §2)
		defense = 0,
	},

	combat = {
		sequenceWindow = 0.9, -- a click within this time after a swing continues the combo
		steps = {
			{ damage = 12, hitDelay = 0.12, duration = 0.38 },
			{ damage = 14, hitDelay = 0.12, duration = 0.38 },
			{ damage = 20, hitDelay = 0.18, duration = 0.55 },
		} :: { ComboStep },
		range = 7, -- studs in front of the player (docs/02 §2)
		width = 7,
		height = 6,
		maxAimAngleDeg = 70, -- server never uses an aim further than this from the character's facing
		-- per-player token bucket for ActionRequest
		rateLimit = { capacity = 4, refillPerSecond = 6 },
	},

	enemies = {
		slime = {
			id = "mob.rain_slime",
			maxHp = 48,
			damage = 12,
			defense = 0,
			walkSpeed = 10,
			noticeRange = 40,
			attackTrigger = 9, -- starts the pounce when this close
			leash = 70, -- gives up and returns home beyond this distance from home
			windup = 0.8, -- crouch before the dash (the teaching moment for dodging)
			dashSpeed = 48,
			dashTime = 0.25,
			hitRadius = 4.5,
			recover = 1.2,
			respawn = 8,
			bodyDiameter = 3.4,
		},
	},

	-- Workspace folders that count as "the world" for ground and line-of-sight raycasts (all that exist are used).
	-- ThapaeWorld = old graybox slice; City_Template = Roblox city template used as the base map (creator decision 2026-10-15).
	worldFolders = { "ThapaeWorld", "City_Template" },

	-- Slime spawn points in METRES in the Tha Phae world of Place2 (X east, Z south, origin = gate node). Used only when
	-- features.combat is on. (A City-template trial used { 67.2, 86.2 }, { 53.5, 92.5 }, { 92.6, 86.3 }; abandoned.)
	slimeSpawnsMeters = { { 18, 8 }, { 26, -22 }, { 30, 34 } },

	-- Free Creator Store effect images (verified by thumbnail): crescent slash and starburst impact.
	fx = {
		slash = "rbxassetid://16050535596",
		impact = "rbxassetid://131876298291179",
	},

	-- Free Creator Store audio (see roblox/assets/third-party-assets.md). Verified to load before use.
	audio = {
		swing = "rbxassetid://5789211405",
		hit = "rbxassetid://79207007520543",
	},
}

return Config

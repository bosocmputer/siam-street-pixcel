--!strict
-- Token-bucket rate limiter keyed by any value (usually a Player). Pure: the clock is injected so tests are exact.

export type RateLimiter = {
	allow: (self: RateLimiter, key: any, now: number) -> boolean,
	remove: (self: RateLimiter, key: any) -> (),
	_capacity: number,
	_refill: number,
	_buckets: { [any]: { tokens: number, last: number } },
}

local RateLimiter = {}
RateLimiter.__index = RateLimiter

function RateLimiter.new(capacity: number, refillPerSecond: number): RateLimiter
	local self = setmetatable({}, RateLimiter)
	self._capacity = capacity
	self._refill = refillPerSecond
	self._buckets = {}
	return (self :: any) :: RateLimiter
end

function RateLimiter.allow(self: RateLimiter, key: any, now: number): boolean
	local b = self._buckets[key]
	if not b then
		b = { tokens = self._capacity, last = now }
		self._buckets[key] = b
	end
	b.tokens = math.min(self._capacity, b.tokens + math.max(0, now - b.last) * self._refill)
	b.last = now
	if b.tokens >= 1 then
		b.tokens -= 1
		return true
	end
	return false
end

function RateLimiter.remove(self: RateLimiter, key: any)
	self._buckets[key] = nil
end

return RateLimiter

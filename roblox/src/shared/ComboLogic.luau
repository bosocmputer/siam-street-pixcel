--!strict
-- Pure combo-step selection (server decides the step; the client's idea of the combo is never trusted).

local ComboLogic = {}

-- prevStep: 0 when no swing yet. elapsed: seconds since the previous swing started.
function ComboLogic.nextStep(prevStep: number, elapsed: number, window: number, maxSteps: number): number
	if prevStep <= 0 or prevStep >= maxSteps or elapsed ~= elapsed or elapsed > window then
		return 1
	end
	return prevStep + 1
end

return ComboLogic

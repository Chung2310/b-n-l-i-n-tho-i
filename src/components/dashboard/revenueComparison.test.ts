import {it,expect} from "vitest";
import {revenueComparisonRange} from "./revenueComparison";
it("uses calendar months across year and leap-year boundaries",()=>{
 expect(revenueComparisonRange("month",new Date("2026-01-15T00:00:00Z"))).toMatchObject({from:"2026-01-01",to:"2026-01-15",previousFrom:"2025-12-01",previousTo:"2025-12-31"});
 expect(revenueComparisonRange("month",new Date("2024-03-15T00:00:00Z"))).toMatchObject({previousFrom:"2024-02-01",previousTo:"2024-02-29"});
});
it("uses Vietnam date and calendar quarter/year",()=>{
 expect(revenueComparisonRange("month",new Date("2026-08-31T18:00:00Z")).from).toBe("2026-09-01");
 expect(revenueComparisonRange("quarter",new Date("2026-09-23T00:00:00Z"))).toMatchObject({from:"2026-07-01",previousFrom:"2026-04-01",previousTo:"2026-06-30"});
 expect(revenueComparisonRange("year",new Date("2026-09-23T00:00:00Z"))).toMatchObject({from:"2026-01-01",previousFrom:"2025-01-01",previousTo:"2025-12-31"});
});

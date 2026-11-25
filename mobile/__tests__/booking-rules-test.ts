import { canCustomerCancel, nextTechnicianStep, showsContact } from "@/lib/booking";

describe("booking rules in the app", () => {
  it("offers the technician exactly one next step", () => {
    expect(nextTechnicianStep("ACCEPTED")).toBe("EN_ROUTE");
    expect(nextTechnicianStep("EN_ROUTE")).toBe("IN_PROGRESS");
    expect(nextTechnicianStep("IN_PROGRESS")).toBe("COMPLETED");
    expect(nextTechnicianStep("COMPLETED")).toBeNull();
    expect(nextTechnicianStep("CANCELLED")).toBeNull();
  });

  it("lets customers cancel only before the technician sets off", () => {
    expect(canCustomerCancel("PENDING")).toBe(true);
    expect(canCustomerCancel("ACCEPTED")).toBe(true);
    expect(canCustomerCancel("EN_ROUTE")).toBe(false);
    expect(canCustomerCancel("COMPLETED")).toBe(false);
  });

  it("shows contact details only once someone is assigned", () => {
    expect(showsContact("PENDING")).toBe(false);
    expect(showsContact("EN_ROUTE")).toBe(true);
    expect(showsContact("CANCELLED")).toBe(false);
  });
});

import { fireEvent, render, screen } from "@testing-library/react-native";
import { useState } from "react";
import { OtpInput } from "@/components/OtpInput";
import { SlotPicker } from "@/components/SlotPicker";
import { createWrapper } from "@/test-utils";

function OtpHarness({ onComplete }: { onComplete: (code: string) => void }) {
  const [code, setCode] = useState("");
  return <OtpInput label="Code" value={code} onChange={setCode} onComplete={onComplete} />;
}

describe("<OtpInput />", () => {
  it("fills the boxes and submits once 6 digits are in, including Arabic-Indic digits", async () => {
    const onComplete = jest.fn();
    await render(<OtpHarness onComplete={onComplete} />, { wrapper: createWrapper() });

    await fireEvent.changeText(screen.getByTestId("otp-input"), "١٢٣");
    expect(screen.getByText("1")).toBeTruthy();
    expect(onComplete).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByTestId("otp-input"), "123456");
    expect(onComplete).toHaveBeenCalledWith("123456");
  });

  it("ignores anything that isn't a digit", async () => {
    const onComplete = jest.fn();
    await render(<OtpHarness onComplete={onComplete} />, { wrapper: createWrapper() });
    await fireEvent.changeText(screen.getByTestId("otp-input"), "12-34 56");
    expect(onComplete).toHaveBeenCalledWith("123456");
  });
});

describe("<SlotPicker />", () => {
  // Monday 19 Oct 2026, 1:30 pm
  const now = new Date(2026, 9, 19, 13, 30);

  it("disables windows that start less than an hour from now", async () => {
    await render(<SlotPicker value={null} onChange={jest.fn()} now={now} />, { wrapper: createWrapper() });
    expect(screen.getByTestId("slot-12")).toBeDisabled();
    expect(screen.getByTestId("slot-14")).toBeDisabled();
    expect(screen.getByTestId("slot-16")).toBeEnabled();
  });

  it("returns the start of the chosen window on the chosen day", async () => {
    const onChange = jest.fn();
    await render(<SlotPicker value={null} onChange={onChange} now={now} />, { wrapper: createWrapper() });

    expect(screen.getByTestId("day-0")).toHaveTextContent("Today");
    await fireEvent.press(screen.getByTestId("day-1"));
    await fireEvent.press(screen.getByTestId("slot-10"));

    expect(onChange).toHaveBeenCalledWith(new Date(2026, 9, 20, 10, 0));
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import { useRef } from "react";
import useThreeScene from "./useThreeScene";

/* Real three.js against jsdom, which has no WebGL — the same situation as a
   browser with WebGL blocked or an unsupported GPU. */

function Host({ build }) {
  const ref = useRef(null);
  const status = useThreeScene(ref, build);
  return <div ref={ref} data-testid="host" data-status={status} />;
}

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = () => null;   // no WebGL, and no jsdom "not implemented" noise
});

it("reports 'failed', never calls build, and leaves no canvas behind when WebGL is unavailable", async () => {
  const build = jest.fn();
  const spy = jest.spyOn(console, "error").mockImplementation(() => {});
  render(<Host build={build} />);
  await waitFor(() => expect(screen.getByTestId("host")).toHaveAttribute("data-status", "failed"));
  expect(build).not.toHaveBeenCalled();
  expect(screen.getByTestId("host")).toBeEmptyDOMElement();
  spy.mockRestore();
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { investigations } from "@/lib/demo/fixtures";
import { api } from "@/lib/api/client";
import type { Investigation } from "@/types";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: { component: React.ComponentType }) => ({ options }),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock("@/components/map/InvestigationMap", () => ({
  InvestigationMap: ({
    investigation,
    onSelect,
  }: {
    investigation: Investigation;
    onSelect: (id: string) => void;
  }) => (
    <button onClick={() => onSelect(investigation.candidates[0]?.id ?? "")}>
      Test map selection
    </button>
  ),
}));
vi.mock("@/lib/api/client", () => ({
  isDemoMode: false,
  api: {
    listInvestigations: vi.fn(),
    capabilities: vi.fn(),
    createInvestigation: vi.fn(),
    getInvestigation: vi.fn(),
  },
}));
import { Route } from "@/routes/investigate";

const Workspace = Route.options.component as React.ComponentType;

const result: Investigation = {
  ...investigations[0]!,
  id: "saved-test",
  isDemo: false,
  status: "completed",
  dataMode: "cached",
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.listInvestigations).mockResolvedValue([]);
  vi.mocked(api.capabilities).mockResolvedValue({ aiAvailable: false, missingConfiguration: [] });
});

describe("Connected workspace", () => {
  it("submits, polls persisted results, and synchronizes map selection", async () => {
    vi.mocked(api.createInvestigation).mockResolvedValue({
      ...result,
      status: "queued",
      candidates: [],
      steps: [],
    });
    vi.mocked(api.getInvestigation).mockResolvedValue(result);
    render(<Workspace />);
    fireEvent.click(screen.getByRole("button", { name: /^Investigate$/ }));
    await waitFor(() => expect(api.createInvestigation).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByText("Execution activity · completed")).toBeInTheDocument(),
    );
    expect(screen.getByText("Cached real data")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Test map selection" }));
    expect(screen.getByText(result.candidates[0]!.rationale)).toBeInTheDocument();
  });

  it("reports backend errors and never fabricates completed results", async () => {
    vi.mocked(api.listInvestigations).mockRejectedValue(new Error("Cannot connect to backend"));
    vi.mocked(api.createInvestigation).mockRejectedValue(new Error("Cannot connect to backend"));
    render(<Workspace />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Cannot connect");
    fireEvent.click(screen.getByRole("button", { name: /^Investigate$/ }));
    expect(screen.queryByText("Demo data")).not.toBeInTheDocument();
    expect(screen.queryByText(result.report.summary)).not.toBeInTheDocument();
  });
});

import { render, screen } from "@testing-library/react";
import { SectionCard } from "./section-card";
import { Header } from "./header-updated";

// Mock next/navigation
jest.mock("next/navigation", () => ({
  usePathname: jest.fn(() => "/"),
}));

// Mock AgentChatPanel
jest.mock("@/components/agent-chat-panel", () => ({
  AgentChatPanel: () => <div data-testid="agent-chat-panel" />,
}));

// Mock shadcn Card
jest.mock("@/components/ui/card", () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>{children}</div>
  ),
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardAction: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("SectionCard", () => {
  test("renders children with section-card padding class", () => {
    render(<SectionCard>Test content</SectionCard>);

    expect(screen.getByText("Test content")).toBeInTheDocument();
    const content = screen.getByTestId("card-content");
    expect(content).toHaveClass("section-card");
  });

  test("passes className to the outer Card", () => {
    render(<SectionCard className="custom-class">content</SectionCard>);
    expect(screen.getByTestId("card")).toHaveClass("custom-class");
  });
});

describe("Header", () => {
  test("renders with h-12 height and border-b class", () => {
    render(<Header />);

    const header = screen.getByRole("banner");
    expect(header).toHaveClass("h-12");
    expect(header).toHaveClass("border-b");
  });

  test("renders page title based on pathname", () => {
    render(<Header />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });
});

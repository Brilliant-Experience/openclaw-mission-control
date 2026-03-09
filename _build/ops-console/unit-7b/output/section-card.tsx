// Re-exports all shadcn Card components plus a SectionCard convenience wrapper
// that applies consistent .section-card padding automatically.

export {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Card, CardContent } from "@/components/ui/card";
import type { ComponentProps } from "react";

type SectionCardProps = ComponentProps<typeof Card> & {
  children: React.ReactNode;
};

/**
 * Convenience wrapper around shadcn Card that applies `.section-card` padding
 * (p-4 md:p-5) automatically. Use instead of <Card><CardContent className="p-4">
 * for consistent spacing across all dashboard sections.
 */
export function SectionCard({ children, className, ...props }: SectionCardProps) {
  return (
    <Card className={className} {...props}>
      <CardContent className="section-card">{children}</CardContent>
    </Card>
  );
}

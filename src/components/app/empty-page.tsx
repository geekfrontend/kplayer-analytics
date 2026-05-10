import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type EmptyPageProps = {
  title: string;
  description: string;
};

export function EmptyPage({ title, description }: EmptyPageProps) {
  return (
    <section className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted">{description}</p>
        </CardContent>
      </Card>
    </section>
  );
}

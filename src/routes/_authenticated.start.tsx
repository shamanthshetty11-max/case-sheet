import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, ArrowRight, ClipboardList, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/start")({
  head: () => ({
    meta: [
      { title: "Choose a workspace — CaseSync" },
      { name: "description", content: "Choose case logging or pre-operative notes in CaseSync." },
      { property: "og:title", content: "Choose a workspace — CaseSync" },
      { property: "og:description", content: "Open your case log or prepare pre-operative notes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StartPage,
});

function StartPage() {
  return (
    <div className="space-y-8">
      <div className="max-w-2xl space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <Activity className="h-4 w-4" /> CaseSync
        </div>
        <h1 className="text-3xl font-semibold">What would you like to open?</h1>
        <p className="text-muted-foreground">Choose where to continue.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <ClipboardList className="mb-2 h-6 w-6 text-primary" />
            <CardTitle>Case log</CardTitle>
            <CardDescription>Review, create, and manage completed procedure records.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/dashboard" className="block">
              <Button className="w-full justify-between">
                Open case log <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <FileText className="mb-2 h-6 w-6 text-primary" />
            <CardTitle>Pre-op notes</CardTitle>
            <CardDescription>Prepare patient details and download an A4 notes image.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/pre-op" className="block">
              <Button variant="outline" className="w-full justify-between">
                Open pre-op notes <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
"use client";

import { CalendarCheck, Clock, FileText, Video } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { CalendlyEmbed } from "./calendly-embed";

const POINTS = [
  { icon: Clock, title: "30 minutes, free", description: "" },
  { icon: FileText, title: "We read your plan first", description: "" },
  { icon: Video, title: "Google Meet", description: "" },
  { icon: CalendarCheck, title: "You leave with a quote", description: "" },
];

export function BookPage() {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[320px_1fr]">
      <Card className="glass h-fit">
        <CardHeader>
          <CardTitle>Book a free call</CardTitle>
          <CardDescription>With the team that would build it.</CardDescription>
        </CardHeader>
        <CardContent>
          <ItemGroup>
            {POINTS.map(({ icon: Icon, title, description }) => (
              <Item key={title} size="sm" className="px-0">
                <ItemMedia variant="icon">
                  <Icon className="text-primary" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{title}</ItemTitle>
                  {description && <ItemDescription>{description}</ItemDescription>}
                </ItemContent>
              </Item>
            ))}
          </ItemGroup>
        </CardContent>
      </Card>
      <CalendlyEmbed planTitle="Rehabit" className="h-[min(760px,80svh)]" />
    </div>
  );
}

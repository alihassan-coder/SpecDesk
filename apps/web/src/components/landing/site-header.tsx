"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, CalendarCheck, Menu, PlayCircle, Workflow } from "lucide-react";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { BookingDialog } from "@/components/booking/booking-dialog";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function SiteHeader() {
  const [booking, setBooking] = useState(false);
  const [menu, setMenu] = useState(false);

  const links = (
    <>
      <Button asChild variant="ghost" size="sm" className="justify-start">
        <Link href="#how-it-works" onClick={() => setMenu(false)}>
          <Workflow className="lg:hidden" /> How it works
        </Link>
      </Button>
      <Button asChild variant="ghost" size="sm" className="justify-start">
        <Link href="/chat/demo">
          <PlayCircle className="lg:hidden" /> Example plan
        </Link>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="justify-start"
        onClick={() => {
          setMenu(false);
          setBooking(true);
        }}
      >
        <CalendarCheck className="lg:hidden" /> Book a call
      </Button>
    </>
  );

  return (
    <header className="sticky top-3 z-30 mx-auto mt-3 w-[calc(100%-2rem)] max-w-6xl">
      <div className="glass flex h-14 items-center gap-3 rounded-2xl pr-2 pl-4">
        <Logo />
        <nav className="mx-auto hidden items-center gap-1 lg:flex" aria-label="Main">
          {links}
        </nav>

        <div className="ml-auto flex items-center gap-1 lg:ml-0">
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/login">
              Start planning <ArrowRight />
            </Link>
          </Button>

          <Sheet open={menu} onOpenChange={setMenu}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>
                  <Logo />
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 px-4" aria-label="Main">
                {links}
              </nav>
              <Separator className="my-2" />
              <div className="flex flex-col gap-2 px-4">
                <Button asChild variant="outline">
                  <Link href="/login">Sign in</Link>
                </Button>
                <Button asChild>
                  <Link href="/login">
                    Start planning <ArrowRight />
                  </Link>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      <BookingDialog open={booking} onOpenChange={setBooking} />
    </header>
  );
}

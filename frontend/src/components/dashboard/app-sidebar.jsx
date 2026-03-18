"use client";

import { Link, useLocation } from "react-router-dom";
import { Separator } from "@/components/ui/separator";
import {
    Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarMenuItem, SidebarMenu, SidebarMenuButton, useSidebar
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { CircleUserRoundIcon, LayoutDashboardIcon, SettingsIcon } from "lucide-react";
import { DashboardUserButton } from "./dashboard-user-button";
import { useAuth } from "@/contexts/AuthContext";

const roleLabelMap = {
    citizen: "Resident",
    admin: "Administrator",
    ministry_officer: "Ministry Officer",
    department_head: "Department Head",
    senior_official: "Senior Official",
    contractor: "Contractor",
    regional_manager: "Regional Manager"
};

export const DashboardSidebar = () => {
    const { user } = useAuth();
    const location = useLocation();
    const { state } = useSidebar();
    const isCollapsed = state === "collapsed";
    const pathname = location.pathname;

    const menuItems = [
        {
            icon: LayoutDashboardIcon,
            label: "Dashboard",
            href: "/dashboard"
        },
        {
            icon: CircleUserRoundIcon,
            label: "Profile",
            href: "/profile"
        },
        {
            icon: SettingsIcon,
            label: "Settings",
            href: "/settings"
        }
    ];

    return (
        <Sidebar>
            <SidebarHeader className="text-sidebar-accent-foreground">
                {!isCollapsed && (
                    <Link to="/" className="flex items-center gap-2 px-2 pt-2">
                        <p className="text-2xl font-semibold">Urban Grid</p>
                    </Link>
                )}
            </SidebarHeader>
            <div className="px-4 py-2">
                <Separator className="opacity-10 text-[#5D6B68]" />
            </div>
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {menuItems.map((item) => (
                                <SidebarMenuItem key={item.href}>
                                    <SidebarMenuButton asChild className={cn(
                                        "h-10 px-3 text-sidebar-foreground hover:bg-white/5",
                                        isCollapsed && "justify-center px-0",
                                        pathname === item.href && "bg-white/10"
                                    )}
                                        isActive={pathname === item.href}
                                    >
                                        <Link to={item.href} className={cn("flex items-center gap-3", isCollapsed && "justify-center")}>
                                            <item.icon size={20} className="text-sidebar-foreground" />
                                            <span className={cn("text-sm font-medium tracking-tight", isCollapsed && "hidden")}>
                                                {item.label}
                                            </span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
                <div className="px-4 py-1">
                    <Separator className="opacity-10 text-[#5D6B68]" />
                </div>
                <SidebarGroup>
                    <SidebarGroupContent>
                        {!isCollapsed && (
                            <div className="rounded-lg border border-border/30 bg-white/5 p-3 text-xs text-sidebar-foreground/90">
                                <p className="font-semibold">Role</p>
                                <p className="mt-1">{roleLabelMap[user?.role] || "User"}</p>
                            </div>
                        )}
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
            <SidebarFooter className={cn("text-white", isCollapsed && "flex justify-center")}>
                <DashboardUserButton />
            </SidebarFooter>
        </Sidebar>
    )
}

const navigation = [
  {
    name: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Auctions",
    href: "/dashboard/auctions",
    icon: Gavel,
  },
  {
    name: "Analytics",
    href: "/dashboard/analytics",
    icon: BarChart3,
    children: [
      {
        name: "Year on year",
        href: "/dashboard/analytics",
      },
      {
        name: "Describers",
        href: "/dashboard/analytics/describers",
      },
      {
        name: "Unsold by describer",
        href: "/dashboard/analytics/describers/unsold",
      },
    ],
  },
  {
    name: "Upload Data",
    href: "/dashboard/upload",
    icon: Upload,
  },
];

import { useGetDashboard } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/StatusDot";
import { Search, Users, Wrench, AlertCircle, CheckCircle2, ChevronRight } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: stats, isLoading } = useGetDashboard();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setLocation(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  if (isLoading || !stats) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded"></div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-muted rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Overview</h1>
          <p className="text-muted-foreground mt-1 text-lg">Shop status at a glance.</p>
        </div>

        <form onSubmit={handleSearch} className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search RO, Name, Vehicle..." 
            className="pl-9 h-11 bg-background border-input shadow-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Open Customers
            </CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.openCustomers}</div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Waiting on Parts
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.customersWaitingOnParts}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-indigo-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Parts Rcvd Today
            </CardTitle>
            <Wrench className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.partsReceivedToday}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Ready to Tech
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.jobsReadyToComplete}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Recently Updated Jobs</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {stats.recentlyUpdated.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">No recent updates.</div>
            ) : (
              <div className="divide-y">
                {stats.recentlyUpdated.map((customer) => (
                  <Link 
                    key={customer.id} 
                    href={`/customers/${customer.id}`}
                    className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <StatusDot status={customer.status} />
                      <div>
                        <div className="font-semibold text-foreground flex items-center gap-2">
                          {customer.name}
                          {customer.roNumber && (
                            <span className="text-xs px-2 py-0.5 bg-secondary text-secondary-foreground rounded-md font-mono">
                              RO: {customer.roNumber}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {customer.vehicleYear} {customer.vehicleMake} {customer.vehicleModel}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right hidden sm:block">
                        <div className="text-sm font-medium">
                          {customer.partsReceived} / {customer.partsTotal} Parts
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Updated {format(new Date(customer.updatedAt), "MMM d, h:mm a")}
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

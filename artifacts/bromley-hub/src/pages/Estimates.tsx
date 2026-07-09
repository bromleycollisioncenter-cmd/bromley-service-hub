import { useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useListVehicles, getListVehiclesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, Car, ChevronRight, AlertTriangle, CheckCircle2, Clock, Wrench } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const STATUS_CONFIG = {
  waiting_on_parts: { label: "Waiting on Parts", color: "bg-yellow-400", icon: Clock },
  in_repair:        { label: "In Repair",         color: "bg-blue-500",   icon: Wrench },
  ready:            { label: "Ready",              color: "bg-green-500",  icon: CheckCircle2 },
  complete:         { label: "Complete",           color: "bg-gray-400",   icon: CheckCircle2 },
  delivered:        { label: "Delivered",          color: "bg-gray-300",   icon: CheckCircle2 },
};

export default function Estimates() {
  const [, navigate] = useLocation();
  const { data: vehicles, isLoading } = useListVehicles();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/estimates/upload`, { method: "POST", body: formData });
      const result = await res.json();

      if (!res.ok) {
        toast({ title: "Upload failed", description: result.error ?? "Unknown error", variant: "destructive" });
      } else {
        toast({
          title: "Estimate imported",
          description: `${result.partsImported} parts extracted. Navigating to job…`,
        });
        queryClient.invalidateQueries({ queryKey: getListVehiclesQueryKey() });
        navigate(`/vehicles/${result.vehicleId}`);
      }
    } catch {
      toast({ title: "Upload failed", description: "Could not reach the server.", variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Estimates</h1>
          <p className="text-muted-foreground mt-1">Upload a CCC ONE estimate PDF to create a new repair job.</p>
        </div>

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleUpload}
          />
          <Button
            size="lg"
            className="font-semibold shadow-sm gap-2"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-5 w-5" />
            {isUploading ? "Importing…" : "Upload CCC Estimate PDF"}
          </Button>
        </div>
      </div>

      {/* Upload CTA when empty */}
      {!isLoading && vehicles?.length === 0 && (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-20 gap-4 text-muted-foreground">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-lg font-medium text-foreground">No repair jobs yet</p>
              <p className="text-sm mt-1">Upload a CCC ONE estimate PDF to get started.</p>
            </div>
            <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading} variant="outline" size="lg">
              <Upload className="mr-2 h-4 w-4" />
              {isUploading ? "Importing…" : "Upload Estimate PDF"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Jobs list */}
      {(isLoading || (vehicles && vehicles.length > 0)) && (
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="divide-y">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-4 flex gap-4 items-center animate-pulse">
                    <div className="w-3 h-3 rounded-full bg-muted" />
                    <div className="h-5 w-48 bg-muted rounded" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="divide-y">
                {vehicles?.map((v) => {
                  const cfg = STATUS_CONFIG[v.status] ?? STATUS_CONFIG.waiting_on_parts;
                  const Icon = cfg.icon;
                  const partsRemaining = (v.partsTotal ?? 0) - (v.partsReceived ?? 0);
                  return (
                    <Link
                      key={v.id}
                      href={`/vehicles/${v.id}`}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-muted/50 transition-colors group gap-4"
                    >
                      <div className="flex items-start sm:items-center gap-4">
                        <div className={`mt-1 sm:mt-0 h-3 w-3 rounded-full flex-shrink-0 ${cfg.color}`} />
                        <div>
                          <div className="font-semibold text-lg flex flex-wrap items-center gap-2">
                            {v.customerName ?? "Unknown Customer"}
                            {v.jobNumber && (
                              <Badge variant="secondary" className="font-mono font-normal text-xs">
                                {v.jobNumber}
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground mt-0.5">
                            {[v.year, v.make, v.model].filter(Boolean).join(" ") || "No vehicle info"}
                            {v.vin && <span className="ml-2 font-mono text-xs opacity-60">{v.vin}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-6 ml-7 sm:ml-0">
                        <div className="flex flex-col sm:items-end text-sm gap-1">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full text-white ${cfg.color}`}>
                            {cfg.label}
                          </span>
                          {(v.partsTotal ?? 0) > 0 && (
                            <span className="text-muted-foreground text-xs">
                              {partsRemaining > 0 ? `${partsRemaining} parts pending` : "All parts in"}
                            </span>
                          )}
                        </div>
                        <div className="h-8 w-8 rounded-full bg-secondary/50 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                          <ChevronRight className="h-4 w-4" />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

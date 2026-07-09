import { useState } from "react";
import { useRoute, Link } from "wouter";
import {
  useGetVehicle,
  useUpdateVehicle,
  useUpdateEstimatePart,
  getGetVehicleQueryKey,
  getListVehiclesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Car, FileText, Package, CheckCircle2, Clock, Wrench,
  AlertTriangle, User, Phone, Shield, Hash,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import type { VehicleStatus } from "@workspace/api-client-react";

const STATUS_OPTIONS: { value: VehicleStatus; label: string; color: string }[] = [
  { value: "waiting_on_parts", label: "Waiting on Parts", color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
  { value: "in_repair",        label: "In Repair",         color: "text-blue-600 bg-blue-50 border-blue-200" },
  { value: "ready",            label: "Ready",              color: "text-green-600 bg-green-50 border-green-200" },
  { value: "complete",         label: "Complete",           color: "text-gray-600 bg-gray-100 border-gray-200" },
  { value: "delivered",        label: "Delivered",          color: "text-gray-500 bg-gray-50 border-gray-200" },
];

function fmt(val: string | null | undefined): string {
  return val ?? "—";
}

function fmtMoney(val: string | null | undefined): string {
  if (!val) return "—";
  const n = parseFloat(val);
  return isNaN(n) ? val : `$${n.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

export default function VehicleDetail() {
  const [, params] = useRoute("/vehicles/:id");
  const id = params?.id ? parseInt(params.id, 10) : 0;
  const queryClient = useQueryClient();

  const { data: vehicle, isLoading } = useGetVehicle(id, {
    query: { enabled: !!id, queryKey: getGetVehicleQueryKey(id) },
  });

  const updateVehicle = useUpdateVehicle();
  const updatePart = useUpdateEstimatePart();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetVehicleQueryKey(id) });
    queryClient.invalidateQueries({ queryKey: getListVehiclesQueryKey() });
  };

  const handleStatusChange = (status: VehicleStatus) => {
    updateVehicle.mutate({ id, data: { status } }, { onSuccess: invalidate });
  };

  const togglePart = (partId: number, field: "ordered" | "received" | "installed", current: boolean) => {
    updatePart.mutate({ id: partId, data: { [field]: !current } }, { onSuccess: invalidate });
  };

  if (isLoading || !vehicle) {
    return (
      <div className="space-y-6 animate-pulse p-4">
        <div className="h-8 w-24 bg-muted rounded" />
        <div className="h-48 bg-muted rounded-xl" />
        <div className="h-64 bg-muted rounded-xl" />
      </div>
    );
  }

  const currentStatus = STATUS_OPTIONS.find((s) => s.value === vehicle.status) ?? STATUS_OPTIONS[0];
  const parts = vehicle.parts ?? [];
  const partsReceived = parts.filter((p) => p.received).length;
  const partsOrdered = parts.filter((p) => p.ordered).length;
  const partsInstalled = parts.filter((p) => p.installed).length;

  const estimate = vehicle.estimate;

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      <Link href="/estimates" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-2">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Estimates
      </Link>

      {/* Status banner when all parts received */}
      {partsReceived > 0 && partsReceived === parts.length && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-4 text-green-800 shadow-sm">
          <CheckCircle2 className="h-8 w-8 text-green-500 flex-shrink-0" />
          <div>
            <h3 className="font-bold text-lg">ALL PARTS RECEIVED</h3>
            <p className="text-sm opacity-90">This job is ready for the technician.</p>
          </div>
        </div>
      )}

      {/* Vehicle header card */}
      <Card className="border-t-4 border-t-primary shadow-md">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
            <div className="space-y-5 flex-1">
              {/* Vehicle title */}
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Unknown Vehicle"}
                </h1>
                {vehicle.trim && (
                  <p className="text-muted-foreground text-sm mt-1">{vehicle.trim}</p>
                )}
              </div>

              {/* Key fields grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-4 text-sm">
                <InfoField label="VIN" value={fmt(vehicle.vin)} mono />
                <InfoField label="Job Number" value={fmt(vehicle.jobNumber)} mono />
                <InfoField label="Workfile ID" value={fmt(vehicle.workfileId)} mono />
                <InfoField label="Color" value={fmt(vehicle.color)} />
                <InfoField label="Mileage" value={fmt(vehicle.mileage)} />
                <InfoField label="Estimator" value={fmt(vehicle.estimator)} />
              </div>

              {/* Customer block */}
              <div className="flex flex-wrap gap-4 pt-2 border-t text-sm">
                {vehicle.customerName && (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span className="font-medium text-foreground">{vehicle.customerName}</span>
                  </span>
                )}
                {vehicle.customerPhone && (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    {vehicle.customerPhone}
                  </span>
                )}
                {vehicle.insuranceCompany && (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Shield className="h-4 w-4" />
                    {vehicle.insuranceCompany}
                  </span>
                )}
                {vehicle.claimNumber && (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Hash className="h-4 w-4" />
                    Claim: {vehicle.claimNumber}
                  </span>
                )}
                {vehicle.policyNumber && (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Hash className="h-4 w-4" />
                    Policy: {vehicle.policyNumber}
                  </span>
                )}
                {vehicle.dateOfLoss && (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <AlertTriangle className="h-4 w-4" />
                    Loss: {vehicle.dateOfLoss}
                  </span>
                )}
              </div>
            </div>

            {/* Status selector */}
            <div className="shrink-0 space-y-3">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Job Status</div>
              <Select value={vehicle.status} onValueChange={(v) => handleStatusChange(v as VehicleStatus)}>
                <SelectTrigger className={`w-52 font-medium border ${currentStatus.color}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-xs text-muted-foreground">
                Updated {format(new Date(vehicle.updatedAt), "MMM d, h:mm a")}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estimate totals */}
      {estimate && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 bg-muted/20 border-b pb-4">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Estimate Summary</CardTitle>
            <span className="ml-auto text-xs text-muted-foreground">{estimate.pdfFilename}</span>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              <TotalField label="Parts" value={fmtMoney(estimate.totalAmount)} />
              <TotalField label="Body Labor" value={`${estimate.bodyLaborHours ?? "—"} hrs`} />
              <TotalField label="Paint Labor" value={`${estimate.paintLaborHours ?? "—"} hrs`} />
              <TotalField label="Paint Supplies" value={fmtMoney(estimate.paintSupplies)} />
              <TotalField label="Miscellaneous" value={fmtMoney(estimate.miscellaneous)} />
              <TotalField label="Tax" value={fmtMoney(estimate.tax)} />
              <TotalField label="Grand Total" value={fmtMoney(estimate.grandTotal)} highlight />
              <TotalField label="Deductible" value={fmtMoney(estimate.deductible)} />
              <TotalField label="Insurance Pays" value={fmtMoney(estimate.insurancePay)} />
              <TotalField label="Customer Pays" value={fmtMoney(estimate.customerPay)} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Parts list */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between bg-muted/20 border-b pb-4">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Parts & Operations</CardTitle>
          </div>
          {parts.length > 0 && (
            <div className="flex gap-2 text-xs font-medium">
              <Badge variant="outline">{partsOrdered}/{parts.length} Ordered</Badge>
              <Badge variant="outline">{partsReceived}/{parts.length} Received</Badge>
              <Badge variant="outline">{partsInstalled}/{parts.length} Installed</Badge>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {parts.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Package className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p>No parts extracted from this estimate.</p>
            </div>
          ) : (
            <>
              {/* Table header */}
              <div className="hidden sm:grid grid-cols-[2rem_1fr_7rem_4rem_5rem_5rem_6rem_6rem_6rem] gap-2 px-4 py-2 bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wide border-b">
                <span>#</span>
                <span>Description</span>
                <span>Part No.</span>
                <span>Oper</span>
                <span className="text-right">Price</span>
                <span className="text-right">Labor</span>
                <span className="text-center">Ordered</span>
                <span className="text-center">Received</span>
                <span className="text-center">Installed</span>
              </div>

              <div className="divide-y">
                {parts.map((part) => (
                  <div
                    key={part.id}
                    className={`px-4 py-3 sm:grid sm:grid-cols-[2rem_1fr_7rem_4rem_5rem_5rem_6rem_6rem_6rem] sm:gap-2 sm:items-center hover:bg-muted/20 transition-colors ${
                      part.received ? "opacity-60" : ""
                    }`}
                  >
                    {/* Line # */}
                    <span className="hidden sm:block text-xs text-muted-foreground">{part.lineNumber}</span>

                    {/* Description */}
                    <div>
                      <span className="font-medium text-sm">{part.description}</span>
                      {/* Mobile-only metadata */}
                      <div className="sm:hidden flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
                        {part.operation && <Badge variant="outline" className="text-xs">{part.operation}</Badge>}
                        {part.partNumber && <span className="font-mono">{part.partNumber}</span>}
                        {part.price && <span>${parseFloat(part.price).toFixed(2)}</span>}
                      </div>
                    </div>

                    {/* Part number */}
                    <span className="hidden sm:block text-xs font-mono text-muted-foreground truncate">
                      {part.partNumber ?? "—"}
                    </span>

                    {/* Operation */}
                    <span className="hidden sm:block">
                      {part.operation ? (
                        <Badge variant="secondary" className="text-xs">{part.operation}</Badge>
                      ) : "—"}
                    </span>

                    {/* Price */}
                    <span className="hidden sm:block text-right text-sm">
                      {part.price ? `$${parseFloat(part.price).toFixed(2)}` : "—"}
                    </span>

                    {/* Labor */}
                    <span className="hidden sm:block text-right text-sm text-muted-foreground">
                      {part.laborHours ? `${part.laborHours}h` : "—"}
                    </span>

                    {/* Checkboxes */}
                    <div className="flex sm:justify-center mt-2 sm:mt-0">
                      <CheckToggle
                        checked={part.ordered}
                        onChange={() => togglePart(part.id, "ordered", part.ordered)}
                        label="Ordered"
                        color="blue"
                      />
                    </div>
                    <div className="flex sm:justify-center">
                      <CheckToggle
                        checked={part.received}
                        onChange={() => togglePart(part.id, "received", part.received)}
                        label="Received"
                        color="green"
                      />
                    </div>
                    <div className="flex sm:justify-center">
                      <CheckToggle
                        checked={part.installed}
                        onChange={() => togglePart(part.id, "installed", part.installed)}
                        label="Installed"
                        color="purple"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InfoField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
      <div className={`font-medium ${mono ? "font-mono text-xs" : ""}`}>{value}</div>
    </div>
  );
}

function TotalField({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`${highlight ? "col-span-2 sm:col-span-1" : ""}`}>
      <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
      <div className={`font-semibold ${highlight ? "text-lg text-primary" : "text-base"}`}>{value}</div>
    </div>
  );
}

function CheckToggle({
  checked,
  onChange,
  label,
  color,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  color: "blue" | "green" | "purple";
}) {
  const colorMap = {
    blue:   { on: "bg-blue-500 border-blue-500 text-white",   off: "border-gray-300 hover:border-blue-300" },
    green:  { on: "bg-green-500 border-green-500 text-white", off: "border-gray-300 hover:border-green-300" },
    purple: { on: "bg-purple-500 border-purple-500 text-white", off: "border-gray-300 hover:border-purple-300" },
  };
  const c = colorMap[color];
  return (
    <button
      onClick={onChange}
      className={`flex items-center gap-1 sm:flex-col sm:gap-0.5 transition-all`}
      title={label}
    >
      <span
        className={`h-5 w-5 rounded border-2 flex items-center justify-center transition-all ${
          checked ? c.on : c.off
        }`}
      >
        {checked && <CheckCircle2 className="h-3 w-3" />}
      </span>
      <span className="text-xs text-muted-foreground sm:hidden">{label}</span>
    </button>
  );
}

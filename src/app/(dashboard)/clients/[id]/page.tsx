import { FileText, MapPin, Pencil, Plus, Users } from "lucide-react";
import { notFound } from "next/navigation";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { can } from "@/server/rbac";
import { getClient } from "@/server/queries/clients";
import {
  getClientFinancials,
  listClientContacts,
  listClientContracts,
  listClientInvoices,
  listClientWorkers,
} from "@/server/queries/client-detail";
import { getSessionUser } from "@/server/session";

import { ClientFormDialog } from "../client-form-dialog";
import { AddContactDialog, AddContractDialog } from "../contact-contract-dialogs";
import { AddProjectDialog, AddSiteDialog } from "../project-site-dialogs";
import { ClientPaymentDialog } from "../../invoices/client-payment-dialog";
import { GenerateInvoiceDialog } from "../../invoices/generate-invoice-dialog";

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value || "—"}</dd>
    </div>
  );
}

function formatDate(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(date);
}

function formatMoney(value: number) {
  return `SAR ${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  const client = await getClient(user, id);
  if (!client) notFound();

  const canEdit = can(user, "update", "client");
  const canManageProjects = can(user, "create", "project");
  const canViewFinancials = can(user, "view", "invoice") || can(user, "view", "workerPayroll");
  const canGenerateInvoice = can(user, "create", "invoice");
  const canRecordPayment = can(user, "create", "clientPayment");

  const [contacts, contracts, workers, financials, invoices] = await Promise.all([
    listClientContacts(client.id),
    listClientContracts(client.id),
    listClientWorkers(client.id),
    canViewFinancials ? getClientFinancials(client.id) : Promise.resolve(null),
    canViewFinancials ? listClientInvoices(client.id) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={client.companyName}
        description={client.contactPerson || undefined}
        actions={
          <>
            <StatusBadge status={client.status} />
            {canEdit && (
              <ClientFormDialog
                clientId={client.id}
                defaultValues={{
                  companyName: client.companyName,
                  contactPerson: client.contactPerson ?? "",
                  phone: client.phone ?? "",
                  email: client.email ?? "",
                  address: client.address ?? "",
                  contractRef: client.contractRef ?? "",
                  paymentTerms: client.paymentTerms ?? "",
                  billingTerms: client.billingTerms ?? "",
                  status: client.status,
                }}
                trigger={
                  <Button variant="outline">
                    <Pencil className="size-4" />
                    Edit
                  </Button>
                }
              />
            )}
          </>
        }
      />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
          <TabsTrigger value="sites">Projects & Sites</TabsTrigger>
          <TabsTrigger value="workers">Workers</TabsTrigger>
          {canViewFinancials && <TabsTrigger value="billing">Billing</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Client Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
              <Detail label="Phone" value={client.phone} />
              <Detail label="Email" value={client.email} />
              <Detail label="Contract Ref." value={client.contractRef} />
              <Detail label="Payment Terms" value={client.paymentTerms} />
              <Detail label="Billing Terms" value={client.billingTerms} />
              <Detail label="Address" value={client.address} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contacts" className="space-y-4">
          <div className="flex justify-end">
            <AddContactDialog clientId={client.id} />
          </div>
          {contacts.length === 0 ? (
            <EmptyState icon={Users} title="No contacts yet" />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Primary</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell className="font-medium">{contact.name}</TableCell>
                      <TableCell>{contact.designation ?? "—"}</TableCell>
                      <TableCell>{contact.phone ?? "—"}</TableCell>
                      <TableCell>{contact.email ?? "—"}</TableCell>
                      <TableCell>{contact.isPrimary ? "Yes" : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="contracts" className="space-y-4">
          <div className="flex justify-end">
            <AddContractDialog clientId={client.id} />
          </div>
          {contracts.length === 0 ? (
            <EmptyState icon={FileText} title="No contracts on file" />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contract #</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contracts.map((contract) => (
                    <TableRow key={contract.id}>
                      <TableCell className="font-medium">{contract.contractNumber ?? "—"}</TableCell>
                      <TableCell>{formatDate(contract.startDate)}</TableCell>
                      <TableCell>{formatDate(contract.endDate)}</TableCell>
                      <TableCell>
                        <StatusBadge status={contract.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="sites" className="space-y-4">
          <div className="flex items-center justify-end">
            {canManageProjects && (
              <AddProjectDialog
                clientId={client.id}
                trigger={
                  <Button size="sm">
                    <Plus className="size-4" />
                    Add Project
                  </Button>
                }
              />
            )}
          </div>

          {client.projects.length === 0 ? (
            <EmptyState icon={MapPin} title="No projects yet" description="Add a project to start adding sites." />
          ) : (
            <div className="space-y-4">
              {client.projects.map((project) => (
                <Card key={project.id}>
                  <CardHeader className="flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-base">{project.name}</CardTitle>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={project.status} />
                      {canManageProjects && (
                        <AddSiteDialog
                          projectId={project.id}
                          trigger={
                            <Button size="sm" variant="outline">
                              <Plus className="size-4" />
                              Add Site
                            </Button>
                          }
                        />
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {project.sites.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No sites added yet.</p>
                    ) : (
                      <ul className="divide-y">
                        {project.sites.map((site) => (
                          <li key={site.id} className="flex items-center justify-between py-2 text-sm">
                            <div>
                              <p className="font-medium">{site.name}</p>
                              {site.location && <p className="text-muted-foreground">{site.location}</p>}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-muted-foreground text-xs">
                                {site._count.assignments} active workers
                              </span>
                              <StatusBadge status={site.status} />
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="workers" className="space-y-4">
          {workers.length === 0 ? (
            <EmptyState icon={Users} title="No workers currently assigned" />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Worker</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead>Worker Rate</TableHead>
                    <TableHead>Client Rate</TableHead>
                    <TableHead>Since</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workers.map((assignment) => (
                    <TableRow key={assignment.id}>
                      <TableCell className="font-medium">
                        <Link href={`/workers/${assignment.worker.id}`} className="hover:underline">
                          {assignment.worker.fullName}
                        </Link>
                      </TableCell>
                      <TableCell>{assignment.worker.designation?.title ?? "—"}</TableCell>
                      <TableCell>{assignment.site.name}</TableCell>
                      <TableCell>{formatMoney(Number(assignment.workerHourlyRate))}</TableCell>
                      <TableCell>{formatMoney(Number(assignment.clientBillingRate))}</TableCell>
                      <TableCell>{formatDate(assignment.startDate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {canViewFinancials && (
          <TabsContent value="billing" className="space-y-4">
            {financials && (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                <SummaryCard label="Revenue" value={formatMoney(financials.revenue)} />
                <SummaryCard label="Invoiced" value={formatMoney(financials.totalInvoiced)} />
                <SummaryCard label="Paid" value={formatMoney(financials.totalPaid)} />
                <SummaryCard label="Outstanding" value={formatMoney(financials.outstanding)} />
                <SummaryCard label="Worker Cost" value={formatMoney(financials.workerCost)} />
                <SummaryCard label="Profitability" value={formatMoney(financials.profit)} />
              </div>
            )}

            <div className="flex justify-end gap-2">
              {canRecordPayment && <ClientPaymentDialog clientId={client.id} />}
              {canGenerateInvoice && (
                <GenerateInvoiceDialog
                  clients={[
                    {
                      id: client.id,
                      companyName: client.companyName,
                      projects: client.projects.map((p) => ({ id: p.id, name: p.name })),
                    },
                  ]}
                  presetClientId={client.id}
                />
              )}
            </div>

            {invoices.length === 0 ? (
              <EmptyState icon={FileText} title="No invoices yet" />
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Billing Period</TableHead>
                      <TableHead>Subtotal</TableHead>
                      <TableHead>Tax</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => {
                      const paid = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);
                      return (
                        <TableRow key={invoice.id}>
                          <TableCell>
                            <Link href={`/invoices/${invoice.id}`} className="font-medium hover:underline">
                              {formatDate(invoice.billingPeriodStart)} – {formatDate(invoice.billingPeriodEnd)}
                            </Link>
                          </TableCell>
                          <TableCell>{formatMoney(Number(invoice.subtotal))}</TableCell>
                          <TableCell>{formatMoney(Number(invoice.taxAmount))}</TableCell>
                          <TableCell className="font-medium">{formatMoney(Number(invoice.totalAmount))}</TableCell>
                          <TableCell>{formatMoney(paid)}</TableCell>
                          <TableCell>
                            <StatusBadge status={invoice.status} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="text-lg font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

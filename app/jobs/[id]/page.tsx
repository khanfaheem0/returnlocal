import JobDetailClient from "./job-detail-client";

type JobDetailPageProps = {
  params: Promise<{ id?: string | string[] }>;
};

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  const { id } = await params;
  const jobId = Array.isArray(id) ? id[0] : id;

  if (!jobId) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="text-sm text-muted-foreground">Missing job id.</div>
      </div>
    );
  }

  return <JobDetailClient jobId={jobId} />;
}

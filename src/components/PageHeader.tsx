export const PageHeader = ({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) => (
  <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
    <div className="space-y-2">
      <h1 className="text-3xl lg:text-4xl font-bold tracking-tight">{title}</h1>
      {description && <p className="text-muted-foreground text-base max-w-2xl">{description}</p>}
    </div>
    {action && <div className="flex-shrink-0">{action}</div>}
  </div>
);

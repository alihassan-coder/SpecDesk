import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";

/** One settings row: title + description on the left, control on the right (shadcn Field, horizontal). */
export function SettingRow({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Field orientation="horizontal">
      <FieldContent>
        <FieldLabel htmlFor={id}>{title}</FieldLabel>
        {description && <FieldDescription>{description}</FieldDescription>}
      </FieldContent>
      {children}
    </Field>
  );
}

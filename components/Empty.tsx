// What a section shows when there is nothing in it yet: one quiet card that says so, and nothing made up.
export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="empty glass">
      <span className="mono">{title}</span>
      {children && <p>{children}</p>}
    </div>
  );
}

import Button from "../ui/Button"

export default function ActionLinks({ names }: { names: string[] }) {
  return (
    <div className="action-links">
      {names.map((name) => (
        <Button
          key={name}
          variant={
            name === "Restore"
              ? "success"
              : name === "Delete"
                ? "danger"
                : "outline"
          }
        >
          {name}
        </Button>
      ))}
    </div>
  )
}

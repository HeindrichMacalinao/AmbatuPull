export default function ActionLinks({ names }: { names: string[] }) {
  return (
    <div className="action-links">
      {names.map((name) => (
        <button className={name === "Delete" ? "action-delete" : ""} key={name}>
          {name}
        </button>
      ))}
    </div>
  )
}

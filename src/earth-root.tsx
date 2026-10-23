import { createRoot } from "react-dom/client"
import { useEffect, useRef, useState } from "react"
import TerraDusk from "./TerraDusk"

function EarthMount() {
    const stage = useRef<HTMLDivElement>(null)
    const [size, setSize] = useState(480)

    useEffect(() => {
        const element = stage.current
        if (!element) return
        const observer = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect
            setSize(Math.max(220, Math.min(700, Math.min(width, height) * 0.84)))
        })
        observer.observe(element)
        return () => observer.disconnect()
    }, [])

    return (
        <div className="earth-stage" ref={stage} aria-label="A slowly rotating Earth">
            <TerraDusk background="#000000" sun="fixed" daylight={58} hover={10} size={size} style={{ width: "100%", height: "100%" }} />
        </div>
    )
}

const mount = document.getElementById("earth-root")
if (mount) createRoot(mount).render(<EarthMount />)

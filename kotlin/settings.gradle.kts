rootProject.name = "ff-promo-kotlin"

include("contracts", "db", "worker", "ld-adapter", "telemetry")

project(":contracts").projectDir = file("modules/contracts")
project(":db").projectDir = file("modules/db")
project(":worker").projectDir = file("modules/worker")
project(":ld-adapter").projectDir = file("modules/ld-adapter")
project(":telemetry").projectDir = file("modules/telemetry")

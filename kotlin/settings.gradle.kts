rootProject.name = "ff-promo-kotlin"

include("contracts", "db", "worker")

project(":contracts").projectDir = file("modules/contracts")
project(":db").projectDir = file("modules/db")
project(":worker").projectDir = file("modules/worker")

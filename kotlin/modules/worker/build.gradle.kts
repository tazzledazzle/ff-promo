plugins {
    kotlin("jvm")
    application
}

dependencies {
    implementation(project(":contracts"))
    implementation(project(":db"))

    implementation("io.temporal:temporal-sdk:${property("temporalVersion")}")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:${property("kotlinxSerializationVersion")}")

    testImplementation(kotlin("test"))
    testImplementation("org.junit.jupiter:junit-jupiter:5.11.4")
    testImplementation("io.temporal:temporal-testing:${property("temporalVersion")}")
}

application {
    mainClass.set("com.ffpromo.worker.WorkerMainKt")
}

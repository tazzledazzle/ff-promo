plugins {
    kotlin("jvm")
}

dependencies {
    implementation(project(":contracts"))

    implementation("org.jetbrains.exposed:exposed-core:${property("exposedVersion")}")
    implementation("org.jetbrains.exposed:exposed-jdbc:${property("exposedVersion")}")
    implementation("org.jetbrains.exposed:exposed-java-time:${property("exposedVersion")}")
    implementation("org.jetbrains.exposed:exposed-json:${property("exposedVersion")}")

    implementation("org.flywaydb:flyway-core:${property("flywayVersion")}")
    implementation("org.flywaydb:flyway-database-postgresql:${property("flywayVersion")}")

    implementation("org.postgresql:postgresql:${property("postgresqlVersion")}")
    implementation("com.zaxxer:HikariCP:${property("hikaricpVersion")}")

    implementation("com.aventrix.jnanoid:jnanoid:${property("jnanoidVersion")}")

    testImplementation(kotlin("test"))
    testImplementation("org.junit.jupiter:junit-jupiter:5.11.4")
    testImplementation("org.testcontainers:testcontainers:${property("testcontainersVersion")}")
    testImplementation("org.testcontainers:postgresql:${property("testcontainersVersion")}")
    testImplementation("org.testcontainers:junit-jupiter:${property("testcontainersVersion")}")
}

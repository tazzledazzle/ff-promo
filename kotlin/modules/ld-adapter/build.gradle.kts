plugins {
    kotlin("jvm")
    kotlin("plugin.serialization")
}

dependencies {
    implementation(project(":contracts"))

    implementation("com.launchdarkly:api-client:${property("ldApiClientVersion")}")
    implementation("com.squareup.okhttp3:okhttp:${property("okhttpVersion")}")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:${property("kotlinxCoroutinesVersion")}")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:${property("kotlinxSerializationVersion")}")

    testImplementation(kotlin("test"))
    testImplementation("org.junit.jupiter:junit-jupiter:5.11.4")
    testImplementation("com.squareup.okhttp3:mockwebserver:${property("okhttpVersion")}")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:${property("kotlinxCoroutinesVersion")}")
}

import java.util.Properties
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// base_image/ සහ font/ ෆෝල්ඩර් වල තියෙන ඒවා build එකේදී ඉබේම assets වලට එකතු වෙනවා.
// Image එකක් හෝ font එකක් මාරු කරන්න ඕන නම් ඒ ෆෝල්ඩර් වල file එක replace කළාම ඇති.
val sceneAssetsDir = layout.buildDirectory.dir("generated/sceneAssets")
val syncSceneAssets by tasks.registering(Sync::class) {
    from(rootProject.file("base_image")) {
        include("*.jpg", "*.jpeg", "*.png", "*.webp")
        into("scenes/sigiriya")
    }
    from(rootProject.file("font")) {
        include("*.ttf", "*.otf", "*.TTF", "*.OTF")
        into("fonts")
    }
    into(sceneAssetsDir)
}

// Play Store release key: release-keystore/keystore.properties (backup කරලා තියාගන්න — නැති වුණොත් app එක update කරන්න බෑ)
val keystoreProps = Properties().apply {
    val f = rootProject.file("release-keystore/keystore.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}

android {
    namespace = "lk.sinhala.welawa"
    compileSdk = 35

    defaultConfig {
        applicationId = "lk.sinhala.welawa"
        minSdk = 24
        targetSdk = 35
        versionCode = 3
        versionName = "1.2"
    }

    sourceSets {
        getByName("main") {
            assets.srcDir(sceneAssetsDir)
        }
    }

    signingConfigs {
        if (keystoreProps.getProperty("storeFile") != null) {
            create("release") {
                storeFile = file(keystoreProps.getProperty("storeFile"))
                storePassword = keystoreProps.getProperty("storePassword")
                keyAlias = keystoreProps.getProperty("keyAlias")
                keyPassword = keystoreProps.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"))
            // Release key එක තියෙනවා නම් ඒකෙන්, නැත්නම් debug key එකෙන් (sideload කරන්න)
            signingConfig = signingConfigs.findByName("release") ?: signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    androidResources {
        noCompress += listOf("jpg", "png")
    }
}

kotlin {
    compilerOptions { jvmTarget.set(JvmTarget.JVM_17) }
}

tasks.named("preBuild") { dependsOn(syncSceneAssets) }

dependencies {
    testImplementation("junit:junit:4.13.2")
}

package com.ffpromo.db

import com.aventrix.jnanoid.jnanoid.NanoIdUtils

/**
 * Generates URL-safe string IDs for repository inserts.
 *
 * v1 Prisma uses `@default(cuid())`; NanoId produces compatible opaque TEXT primary keys.
 */
object IdGenerator {
    private val alphabet = "0123456789abcdefghijklmnopqrstuvwxyz".toCharArray()
    private const val SIZE = 24

    fun newId(): String = NanoIdUtils.randomNanoId(NanoIdUtils.DEFAULT_NUMBER_GENERATOR, alphabet, SIZE)
}

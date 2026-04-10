import Foundation

public struct VerificationResult: Identifiable, Hashable {
    public let hadith: HadithRecord
    public let score: Double

    public var id: String { hadith.id }
}

public final class HadithRepository {
    public private(set) var records: [HadithRecord]
    public private(set) var manifest: HadithContentManifest

    public init(records: [HadithRecord]? = nil, manifest: HadithContentManifest? = nil) {
        if let records, let manifest {
            self.records = records
            self.manifest = manifest
            return
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        guard
            let recordsURL = Bundle.hadithCore.url(forResource: "SeedHadith", withExtension: "json"),
            let manifestURL = Bundle.hadithCore.url(forResource: "ContentManifest", withExtension: "json"),
            let recordData = try? Data(contentsOf: recordsURL),
            let manifestData = try? Data(contentsOf: manifestURL),
            let decodedRecords = try? decoder.decode([HadithRecord].self, from: recordData),
            let decodedManifest = try? decoder.decode(HadithContentManifest.self, from: manifestData)
        else {
            self.records = []
            self.manifest = HadithContentManifest(
                version: "0.0.0",
                updatedAt: .now,
                canonicalCollections: [],
                verificationSources: [],
                notes: ["Seed content unavailable."]
            )
            return
        }

        self.records = decodedRecords.sorted {
            ($0.collection.rawValue, $0.hadithNumber) < ($1.collection.rawValue, $1.hadithNumber)
        }
        self.manifest = decodedManifest
    }

    public func featuredHadith(for date: Date) -> HadithRecord? {
        guard !records.isEmpty else { return nil }
        let index = Calendar(identifier: .gregorian).ordinality(of: .day, in: .year, for: date).map { ($0 - 1) % records.count } ?? 0
        return records[index]
    }

    public func record(id: String) -> HadithRecord? {
        records.first(where: { $0.id == id })
    }

    public func search(query: String, collection: HadithCollection? = nil) -> [HadithRecord] {
        let normalizedQuery = normalize(query)
        return records.filter { record in
            guard collection == nil || record.collection == collection else { return false }
            guard !normalizedQuery.isEmpty else { return true }

            let haystack = [
                record.arabicText,
                record.englishText,
                record.narrator,
                record.chapterTitle,
                record.bookTitle,
                record.collection.displayName
            ]
            .map(normalize)
            .joined(separator: " ")

            return haystack.contains(normalizedQuery)
        }
    }

    public func verify(snippet: String) -> [VerificationResult] {
        let query = normalize(snippet)
        guard !query.isEmpty else { return [] }

        return records.compactMap { record in
            let candidates = [
                normalize(record.arabicText),
                normalize(record.englishText)
            ]
            let bestScore = candidates.map { score(query: query, candidate: $0) }.max() ?? 0
            guard bestScore > 0.18 else { return nil }
            return VerificationResult(hadith: record, score: bestScore)
        }
        .sorted { lhs, rhs in
            if lhs.score == rhs.score {
                return lhs.hadith.hadithNumber < rhs.hadith.hadithNumber
            }
            return lhs.score > rhs.score
        }
    }

    private func normalize(_ input: String) -> String {
        input
            .folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
            .replacingOccurrences(of: "[^\\p{L}\\p{N}\\s]", with: " ", options: .regularExpression)
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func score(query: String, candidate: String) -> Double {
        guard !candidate.isEmpty else { return 0 }
        if candidate.contains(query) { return 1 }

        let queryTokens = Set(query.split(separator: " ").map(String.init))
        let candidateTokens = Set(candidate.split(separator: " ").map(String.init))
        guard !queryTokens.isEmpty else { return 0 }

        let shared = queryTokens.intersection(candidateTokens).count
        return Double(shared) / Double(queryTokens.count)
    }
}

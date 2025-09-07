import { NextResponse } from "next/server";
import { collection, doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";

const GITHUB_ORG = process.env.GITHUB_ORG!;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const baseUri = "https://api.github.com/";

export async function GET() {
  try {
    // Step 1: fetch repos
    const reposRes = await fetch(`${baseUri}orgs/${GITHUB_ORG}/repos`, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
      },
    });
    const repos = await reposRes.json();

    let allPRs: any[] = [];

    // Step 2: loop repos → fetch open non-draft PRs
    for (const repo of repos) {
      const pullsRes = await fetch(
        `${baseUri}repos/${GITHUB_ORG}/${repo.name}/pulls?state=open&per_page=20`,
        {
          headers: {
            Authorization: `Bearer ${GITHUB_TOKEN}`,
            Accept: "application/vnd.github+json",
          },
        }
      );
      const pulls = await pullsRes.json();
      if (!pulls || pulls.length === 0) continue;

      for (const pr of pulls.filter((p: any) => !p.draft)) {
        const reviewsRes = await fetch(
          `${baseUri}repos/${GITHUB_ORG}/${repo.name}/pulls/${pr.number}/reviews`,
          {
            headers: {
              Authorization: `Bearer ${GITHUB_TOKEN}`,
              Accept: "application/vnd.github+json",
            },
          }
        );
        const reviews = await reviewsRes.json();
        const approvalCount = reviews.filter((r: any) => r.state === "APPROVED")
          .length;

        allPRs.push({
          id: `${repo.name}-${pr.number}`,
          title: pr.title,
          repo: `${GITHUB_ORG}/${repo.name}`,
          author: pr.user.login,
          url: pr.html_url,
          updated_at: pr.updated_at,
          approvals: approvalCount,
        });
      }
    }

    // Step 3: sort by approvals (ascending)
    allPRs.sort((a, b) => a.approvals - b.approvals);

    // Step 4: write into Firestore
    const colRef = collection(db, "prs");
    await Promise.all(
      allPRs.map((pr) =>
        setDoc(doc(colRef, pr.id), pr, { merge: true })
      )
    );

    // Step 5: update metadata with last refresh timestamp
    const metadataRef = collection(db, "metadata");
    await setDoc(doc(metadataRef, "system"), {
      lastRefresh: new Date().toISOString(),
      lastRefreshCount: allPRs.length
    }, { merge: true });

    return NextResponse.json({ success: true, count: allPRs.length });
  } catch (error) {
    console.error("Refresh failed:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

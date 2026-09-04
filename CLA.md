<!--
  MAINTAINER NOTE — this CLA is a working draft prepared to unblock the
  relicensing/commercial path (MTP) and acquisition due diligence. It has NOT
  yet been reviewed by counsel. Before relying on it for anything material,
  route it through docs/compliance/legal-review-todo.md and have a lawyer
  confirm the grant is broad enough and the governing-law clause is right.
-->

# Aegis Contributor License Agreement

**Version 1.0**

Thank you for your interest in contributing to Aegis ("the Project"), a project
maintained by **ObiLabs** ("ObiLabs", "we", "us"). This Contributor License
Agreement ("Agreement") sets out the terms under which you contribute code,
documentation, or other material to the Project.

The Project is released to the public under the GNU Affero General Public
License v3.0 (AGPL-3.0). AGPL is a strong copyleft licence: without a separate
grant from each contributor, ObiLabs could not offer the Project (or code
derived from a contribution) under any other terms. This Agreement provides
that grant, so that ObiLabs can continue to build commercial and
source-available products (such as the MSP portal) on top of the same codebase
while keeping Aegis itself free and open under AGPL.

**You keep the copyright to your contributions.** This is a licence, not an
assignment — you are not signing your work over to ObiLabs.

By signing this Agreement (see **How to sign** below) you accept the following
terms for your past, present, and future Contributions to the Project.

---

## 1. Definitions

- **"You" / "Your"** means the individual or legal entity that owns, or is
  legally entitled to license, the Contribution and that agrees to this
  Agreement. For a legal entity, "You" includes the entity and all other
  entities that control, are controlled by, or are under common control with it.
- **"Contribution"** means any original work of authorship, including any
  modifications or additions to an existing work, that You intentionally submit
  to the Project for inclusion in, or documentation of, the Project. "Submit"
  means any form of electronic, verbal, or written communication sent to
  ObiLabs or the Project — including but not limited to pull requests, patches,
  issues, and comments on source-code management systems — but excludes any
  communication conspicuously marked in writing as "Not a Contribution."
- **"Project"** means the Aegis software and associated materials maintained by
  ObiLabs, including the repository at `github.com/obilabs/aegis`.

## 2. Copyright licence

You grant to ObiLabs, and to recipients of software distributed by ObiLabs, a
perpetual, worldwide, non-exclusive, no-charge, royalty-free, irrevocable
copyright licence to reproduce, prepare derivative works of, publicly display,
publicly perform, sublicense, and distribute Your Contribution and such
derivative works.

## 3. Right to relicense

In addition to Section 2, You grant ObiLabs the right to **license and
sublicense Your Contribution, and any derivative work of it, under any licence
terms** — including permissive, source-available, and proprietary or
commercial terms — and to include Your Contribution in products that are
licensed on such terms. This right lets ObiLabs relicense the Project as a
whole and offer commercial products built from it, without seeking further
permission from You.

For the avoidance of doubt: this Section does **not** remove Your Contribution
from the AGPL-licensed Project. Aegis remains available under AGPL-3.0; this
Section grants ObiLabs additional outbound licensing rights, it does not narrow
anyone else's.

## 4. Patent licence

You grant to ObiLabs and to recipients of software distributed by ObiLabs a
perpetual, worldwide, non-exclusive, no-charge, royalty-free, irrevocable
(except as stated in this Section) patent licence to make, have made, use,
offer to sell, sell, import, and otherwise transfer Your Contribution, where
such licence applies only to those patent claims licensable by You that are
necessarily infringed by Your Contribution alone or by combination of Your
Contribution with the Project. If any entity institutes patent litigation
against You or any other entity (including a cross-claim or counterclaim in a
lawsuit) alleging that Your Contribution, or the Project to which You
contributed, constitutes direct or contributory patent infringement, then any
patent licences granted to that entity under this Agreement for that
Contribution or Project shall terminate as of the date such litigation is
filed.

## 5. Your representations

You represent that:

1. Each of Your Contributions is Your original creation, and You are legally
   entitled to grant the licences above.
2. If Your employer(s) have rights to intellectual property that You create
   that includes Your Contributions, You have received permission to make the
   Contributions on behalf of that employer, that employer has waived such
   rights for Your Contributions, or that employer has signed the entity form
   of this Agreement.
3. Your Contribution includes complete details of any third-party licence or
   other restriction (including related patents and trademarks) of which You
   are personally aware and which are associated with any part of Your
   Contribution.

## 6. Third-party materials

Should You wish to submit work that is not Your original creation, You may
submit it separately from any Contribution, identifying the complete details of
its source and of any licence or other restriction (including, but not limited
to, related patents, trademarks, and licence agreements) of which You are
personally aware, and conspicuously marking the work as
"Submitted on behalf of a third party: [named here]".

## 7. No obligation

You understand that the decision to include Your Contribution in any project or
source repository is entirely that of ObiLabs, and this Agreement does not
guarantee that the Contributions will be included in any product.

## 8. Disclaimer

Unless required by applicable law or agreed to in writing, You provide Your
Contributions on an **"AS IS" basis, without warranties or conditions of any
kind**, either express or implied, including, without limitation, any
warranties or conditions of title, non-infringement, merchantability, or
fitness for a particular purpose.

## 9. Miscellaneous

This Agreement is the entire agreement between You and ObiLabs regarding
Contributions and supersedes any prior agreement on that subject. If any
provision is held unenforceable, the remaining provisions remain in effect.
Governing law: **[TO BE SET BY OBILABS — e.g. the Province of Ontario, Canada]**.

---

## How to sign

Signing is a one-line pull request:

1. Read this Agreement in full.
2. Open a pull request that adds your GitHub username to the appropriate list in
   [`.github/cla-signers.yml`](.github/cla-signers.yml):
   - individuals → the `individuals:` list;
   - a company signing on behalf of its employees → the `entities:` list, with a
     contact.
3. In that pull request's description, include the line:

   > I have read the Aegis Contributor License Agreement and I agree to it.

**Adding your username to `.github/cla-signers.yml` in a pull request that
includes the sentence above is your signature.** Once a maintainer merges it,
the CLA check will pass on your code pull requests.

Contributors who are employees or contractors of ObiLabs are covered by their
employment/contractor terms and are listed under `organization:` — they do not
need to sign separately.

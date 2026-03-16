import OpeningDetailClient from "./OpeningDetailClient";

export default async function OpeningDetail({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <OpeningDetailClient id={id} />;
}

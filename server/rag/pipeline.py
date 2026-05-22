import os
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS

VECTORSTORE_PATH = os.path.join(os.path.dirname(__file__), "vectorstore", "faiss_index")
os.makedirs(os.path.dirname(VECTORSTORE_PATH), exist_ok=True)

embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

def process_and_store_document(file_path: str, document_id: int):
    # Load document
    if file_path.endswith(".pdf"):
        loader = PyPDFLoader(file_path)
    elif file_path.endswith(".txt"):
        loader = TextLoader(file_path)
    else:
        raise ValueError("Unsupported file type")
    
    docs = loader.load()

    # Add metadata
    for doc in docs:
        doc.metadata["document_id"] = document_id

    # Chunking
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=100,
        length_function=len
    )
    chunks = text_splitter.split_documents(docs)

    # Store in FAISS
    if os.path.exists(VECTORSTORE_PATH):
        vectorstore = FAISS.load_local(VECTORSTORE_PATH, embeddings, allow_dangerous_deserialization=True)
        vectorstore.add_documents(chunks)
    else:
        vectorstore = FAISS.from_documents(chunks, embeddings)
    
    vectorstore.save_local(VECTORSTORE_PATH)
    return len(chunks)

def get_retriever(document_id: int = None):
    if os.path.exists(VECTORSTORE_PATH):
        try:
            vectorstore = FAISS.load_local(VECTORSTORE_PATH, embeddings, allow_dangerous_deserialization=True)
            search_kwargs = {"k": 5}
            if document_id is not None:
                search_kwargs["filter"] = {"document_id": document_id}
            return vectorstore.as_retriever(search_kwargs=search_kwargs)
        except Exception:
            return None
    return None

def delete_document_from_vectorstore(document_id: int):
    if os.path.exists(VECTORSTORE_PATH):
        try:
            vectorstore = FAISS.load_local(VECTORSTORE_PATH, embeddings, allow_dangerous_deserialization=True)
            ids_to_delete = []
            for doc_id, doc in vectorstore.docstore._dict.items():
                if doc.metadata.get("document_id") == document_id:
                    ids_to_delete.append(doc_id)
            if ids_to_delete:
                vectorstore.delete(ids_to_delete)
                vectorstore.save_local(VECTORSTORE_PATH)
        except Exception as e:
            print(f"Error deleting from vectorstore: {e}")

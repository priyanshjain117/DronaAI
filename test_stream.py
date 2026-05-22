import asyncio
import os
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain.chains.combine_documents import create_stuff_documents_chain

async def main():
    llm = ChatGroq(temperature=0, model_name="llama-3.1-8b-instant", groq_api_key=os.environ.get("GROQ_API_KEY"))
    prompt = ChatPromptTemplate.from_messages([("system", "Context:\n{context}"), ("human", "{input}")])
    chain = create_stuff_documents_chain(llm, prompt)
    
    async for chunk in chain.astream({"input": "Say hello world", "context": []}):
        print("CHUNK:", repr(chunk))

asyncio.run(main())

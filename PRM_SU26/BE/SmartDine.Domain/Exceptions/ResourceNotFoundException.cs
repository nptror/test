using System;
using System.Collections.Generic;
using System.Text;

namespace SmartDine.Domain.Exceptions
{
    public class ResourceNotFoundException : DomainException
    {
        public ResourceNotFoundException(string message) : base(message)
        {
        }
    }
}
